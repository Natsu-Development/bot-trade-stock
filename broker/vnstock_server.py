#!/usr/bin/env python3
"""
High-Performance gRPC Stock Data Server
Persistent Python process with vnstock connection pooling
"""

import grpc
from concurrent import futures
import time
import logging
import sys

# Add generated gRPC files to path
sys.path.append('grpc-broker/vnstock')
import vnstock_pb2
import vnstock_pb2_grpc

import vnstock as vn
import pandas as pd
from datetime import datetime
from typing import Dict, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HighPerformanceStockService(vnstock_pb2_grpc.StockDataServiceServicer):
    def __init__(self):
        """Initialize with persistent vnstock client"""
        self.stock_client = vn.Vnstock()
        self.cache = {}  # Simple in-memory cache
        self.cache_ttl = 30  # 30 seconds cache TTL
        logger.info("🚀 High-Performance Stock Service initialized")
    
    def _is_cache_valid(self, symbol: str) -> bool:
        """Check if cached data is still valid"""
        if symbol not in self.cache:
            return False
        
        cache_time = self.cache[symbol].get('timestamp', 0)
        return (time.time() - cache_time) < self.cache_ttl
    
    def _get_stock_data_optimized(self, symbol: str, start_date: str = "", end_date: str = "", interval: str = "1D") -> Optional[Dict]:
        """Optimized stock data fetching with caching - supports exact date ranges and intervals"""
        # Create cache key based on all parameters
        cache_key = f"{symbol}_{start_date}_{end_date}_{interval}"
        
        # Check cache first
        if self._is_cache_valid(cache_key):
            logger.info(f"📋 Cache hit for {symbol}")
            return self.cache[cache_key]['data']
        
        try:
            # Use exact dates provided by Go client (already validated)
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                
            # Log the final date range being used
            logger.info(f"📊 Fetching data for {symbol} from {start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')} with interval '{interval}'")
            
            # Get stock data using exact dates (no additional processing needed)
            stock_obj = self.stock_client.stock(symbol=symbol.upper(), source="VCI")
            df = stock_obj.quote.history(
                start=start_dt.strftime("%Y-%m-%d"), 
                end=end_dt.strftime("%Y-%m-%d"),
                interval=interval
            )
            
            if df.empty:
                logger.warning(f"No data found for symbol: {symbol}")
                return None
            
            # Sort and process data efficiently
            df = df.sort_values('time')

            # Keep only 200 most recent records when df has more than 200 rows
            if len(df) > 200:
                logger.warning(f"Keeping only 200 most recent records for {symbol} (out of {len(df)} total)")
                df = df.iloc[-200:]
           
            logger.info(f"📊 Data fetched for {symbol}: {len(df)} rows, date range: {df['time'].min()} to {df['time'].max()}")
            
            # Extract price history (optimized)
            price_data = []
            for idx, (_, row) in enumerate(df.iterrows()):
                close_price = float(row['close']) if pd.notna(row['close']) else 0.0
                price_data.append({
                    "date": row['time'].strftime("%Y-%m-%d") if pd.notna(row['time']) else "",
                    "close": close_price,
                    "volume": int(row['volume']) if pd.notna(row['volume']) else 0,
                    "high": float(row['high']) if pd.notna(row['high']) else 0.0,
                    "low": float(row['low']) if pd.notna(row['low']) else 0.0
                })
                
                # Debug: Log first and last few prices
                if idx < 3 or idx >= len(df) - 3:
                    logger.info(f"💰 Price[{idx}]: Date={row['time'].strftime('%Y-%m-%d') if pd.notna(row['time']) else 'N/A'}, Close={close_price}")
            
            # Calculate market metrics efficiently
            latest_data = df.iloc[-1]
            prev_data = df.iloc[-2] if len(df) > 1 else latest_data
            
            latest_price = float(latest_data['close'])
            prev_price = float(prev_data['close'])
            price_change = latest_price - prev_price
            price_change_percent = (price_change / prev_price * 100) if prev_price != 0 else 0.0
            
            # Volume analysis
            current_volume = int(latest_data['volume']) if pd.notna(latest_data['volume']) else 0
            avg_volume = int(df['volume'].mean()) if not df['volume'].isna().all() else 0
            volume_ratio = (current_volume / avg_volume) if avg_volume > 0 else 1.0
            
            # Volatility
            high_low_spread = float(latest_data['high'] - latest_data['low'])
            price_volatility = (high_low_spread / latest_price * 100) if latest_price > 0 else 0.0
            
            result = {
                "symbol": symbol.upper(),
                "timestamp": datetime.now().isoformat(),
                "market_data": {
                    "latest_price": latest_price,
                    "price_change": round(price_change, 2),
                    "price_change_percent": round(price_change_percent, 2),
                    "current_volume": current_volume,
                    "volume_ratio": round(volume_ratio, 2),
                    "price_volatility": round(price_volatility, 2),
                    "trading_date": latest_data['time'].strftime("%Y-%m-%d") if pd.notna(latest_data['time']) else ""
                },
                "price_history": price_data,
                "data_points": len(price_data),
                "status": "success"
            }

            logger.info(f"📊 Result for {symbol}: {len(result['price_history'])} price data points")
            
            # Cache the result
            self.cache[cache_key] = {
                'data': result,
                'timestamp': time.time()
            }
            
            logger.info(f"✅ Fetched and cached data for {symbol}: {latest_price} VND")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error fetching {symbol}: {str(e)}")
            return {
                "symbol": symbol.upper(),
                "timestamp": datetime.now().isoformat(),
                "status": "error",
                "error": str(e)
            }
    
    def GetStockData(self, request, context):
        """gRPC method to get single stock data with date range and interval support"""
        symbol = request.symbol
        start_date = request.start_date if request.start_date else ""
        end_date = request.end_date if request.end_date else ""
        interval = request.interval if request.interval else ""
        
        logger.info(f"📊 gRPC request for {symbol} from {start_date} to {end_date} with interval {interval}")

        
        data = self._get_stock_data_optimized(symbol, start_date, end_date, interval)
        
        if not data or data.get('status') == 'error':
            return vnstock_pb2.StockResponse(
                symbol=symbol,
                timestamp=datetime.now().isoformat(),
                status="error",
                error=data.get('error', 'Failed to fetch data') if data else 'No data available'
            )
        
        # Convert to protobuf message
        market_data = vnstock_pb2.MarketData(
            latest_price=data['market_data']['latest_price'],
            price_change=data['market_data']['price_change'],
            price_change_percent=data['market_data']['price_change_percent'],
            current_volume=data['market_data']['current_volume'],
            volume_ratio=data['market_data']['volume_ratio'],
            price_volatility=data['market_data']['price_volatility'],
            trading_date=data['market_data']['trading_date']
        )
        
        price_history = []
        for price in data['price_history']:
            price_history.append(vnstock_pb2.PriceData(
                date=price['date'],
                close=price['close'],
                volume=price['volume'],
                high=price['high'],
                low=price['low']
            ))
        
        return vnstock_pb2.StockResponse(
            symbol=data['symbol'],
            timestamp=data['timestamp'],
            market_data=market_data,
            price_history=price_history,
            data_points=data['data_points'],
            status=data['status']
        )
    

def serve():
    """Start the gRPC server"""
    # Create server with thread pool
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    # Add service to server
    vnstock_pb2_grpc.add_StockDataServiceServicer_to_server(
        HighPerformanceStockService(), server
    )
    
    # Configure server
    listen_addr = '[::]:50051'
    server.add_insecure_port(listen_addr)
    
    # Start server
    server.start()
    
    print("🚀 High-Performance gRPC Stock Server Started!")
    print(f"🌐 Listening on {listen_addr}")
    print("⚡ Features:")
    print("  • Persistent Python process (no startup overhead)")
    print("  • Connection pooling with vnstock")
    print("  • In-memory caching (30s TTL)")
    print("  • Protocol Buffers (binary serialization)")
    print("  • Concurrent request handling")
    print("\n📊 Available gRPC methods:")
    print("  • GetStockData(symbol, start_date, end_date, interval)")
    print("\n🎯 Date Range Support:")
    print("  • start_date/end_date: YYYY-MM-DD format")
    print("  • interval: 1d, 1h, 4h, 15m, etc.")
    print("  • All validation handled by Go client")
    
    try:
        while True:
            time.sleep(86400)  # Keep server running
    except KeyboardInterrupt:
        print("\n🛑 Shutting down gRPC server...")
        server.stop(0)

if __name__ == '__main__':
    serve()

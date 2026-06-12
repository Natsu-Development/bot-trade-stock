// Package filter provides shared immutable value objects for screener filter bounded contexts.
package filter

// Group is one level of grouping: a combinator over Conditions, optionally
// negated. A group holds ONLY conditions — it cannot contain sub-groups
// (the model is bounded to two levels by construction).
type Group struct {
	Match      MatchMode   `json:"match"            bson:"match"`
	Negate     bool        `json:"negate,omitempty" bson:"negate,omitempty"`
	Conditions []Condition `json:"conditions"       bson:"conditions"`
}

// validate normalizes an empty Match to MatchAnd, validates each condition, and
// returns the number of leaf conditions in the group.
func (g *Group) validate() (int, error) {
	if g.Match == "" {
		g.Match = MatchAnd
	}
	for i := range g.Conditions {
		if err := g.Conditions[i].validate(); err != nil {
			return 0, err
		}
	}
	return len(g.Conditions), nil
}

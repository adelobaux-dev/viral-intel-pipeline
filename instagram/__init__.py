"""Instagram sell-by-chat inbound bot for the Body Contouring Academy account.

Compliant by design: this package only ever *replies* to people who message
the BCA account first (DM, story reply, or ad/CTA-initiated conversation),
which keeps every send inside Meta's 24h messaging window. It never
enumerates or cold-contacts the follower list.
"""

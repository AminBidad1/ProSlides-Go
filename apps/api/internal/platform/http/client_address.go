package platformhttp

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// ClientAddress returns the direct peer unless it is a configured trusted
// proxy. For trusted proxies it walks X-Forwarded-For from right to left and
// returns the first untrusted address, so user-supplied left-side prefixes
// cannot spoof the rate-limit identity.
func ClientAddress(r *http.Request, trustedProxyCIDRs []netip.Prefix) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(strings.TrimSpace(host))
	if err != nil || !ContainsAddress(trustedProxyCIDRs, peer) {
		return host
	}

	chain := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(chain) - 1; i >= 0; i-- {
		candidate, parseErr := netip.ParseAddr(strings.TrimSpace(chain[i]))
		if parseErr == nil && !ContainsAddress(trustedProxyCIDRs, candidate) {
			return candidate.String()
		}
	}
	return host
}

func ContainsAddress(prefixes []netip.Prefix, address netip.Addr) bool {
	for _, prefix := range prefixes {
		if prefix.Contains(address) {
			return true
		}
	}
	return false
}

package platformhttp

import (
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestClientAddressIgnoresForwardedChainFromUntrustedPeer(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.RemoteAddr = "192.0.2.10:1234"
	request.Header.Set("X-Forwarded-For", "198.51.100.20")

	got := ClientAddress(request, []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")})
	if got != "192.0.2.10" {
		t.Fatalf("client address = %q", got)
	}
}

func TestClientAddressUsesRightMostUntrustedForwardedAddress(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.RemoteAddr = "10.0.0.5:1234"
	request.Header.Set("X-Forwarded-For", "203.0.113.99, 198.51.100.20, 10.0.0.4")

	got := ClientAddress(request, []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")})
	if got != "198.51.100.20" {
		t.Fatalf("client address = %q", got)
	}
}

#!/usr/bin/env bash
# Production network baseline: separates edge/CDN latency from site behaviour.
#
# Uses curl's timing decomposition. `tls` is the TLS handshake, `ttfb` time to
# first byte. Comparing alistereno.top against unrelated hosts on the same
# connection path tells us how much of the TTFB is this machine's RTT to the
# edge rather than anything the site does.
#
# Usage: bash scripts/perf/net-baseline.sh [origin]
set -uo pipefail

ORIGIN="${1:-https://alistereno.top}"
OUT_DIR="test-results/perf"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/net-baseline-$STAMP.txt"

emit() { echo "$@" | tee -a "$OUT"; }

emit "# Network baseline $(date -u +%FT%TZ)"
emit "# Origin: $ORIGIN"
emit ""

# One connection reused across URLs: entry N>1 has connect=0, so its ttfb is
# ~1 RTT + server time, without handshake cost.
measure_reuse() {
	local label="$1"; shift
	emit "## $label (reused connection, connect=0 => warm)"
	local i=0
	for u in "$@"; do
		i=$((i + 1))
		curl -s --compressed -o /dev/null \
			-w "  req$i connects=%{num_connects} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} bytes=%{size_download} url=%{url_effective}\n" \
			"$u" | tee -a "$OUT"
	done
}

measure_reuse "alistereno.top routes" \
	"$ORIGIN/" "$ORIGIN/posts/" "$ORIGIN/community/" "$ORIGIN/archive/"

measure_reuse "control hosts (same machine, different origins)" \
	"https://www.cloudflare.com/" "https://example.com/" "https://github.com/"

emit ""
emit "## cold connection (fresh TLS each time)"
for u in "$ORIGIN/" "$ORIGIN/posts/" "$ORIGIN/api/v1/health" \
	"$ORIGIN/api/v1/community/posts" "$ORIGIN/api/v1/community/posts/community-start"; do
	curl -s --compressed -o /dev/null \
		-w "  conect=%{num_connects} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} bytes=%{size_download} url=%{url_effective}\n" \
		"$u" | tee -a "$OUT"
done

emit ""
emit "## headers (cache behaviour)"
for u in "$ORIGIN/" "$ORIGIN/posts/" "$ORIGIN/community/" "$ORIGIN/archive/" \
	"$ORIGIN/api/v1/health" "$ORIGIN/api/v1/community/posts" \
	"$ORIGIN/api/v1/community/posts/community-start" "$ORIGIN/api/v1/views/hello-alister-blog" \
	"$ORIGIN/api/v1/comments/hello-alister-blog"; do
	{
		echo "### $u"
		curl -s --compressed -o /dev/null -D - "$u" |
			grep -iE '^(HTTP/|cache-control|cf-cache-status|age|etag|content-encoding|content-type|content-length|vary|expires|last-modified|cf-ray|server-timing|link)' |
			sed 's/^/  /'
	} | tee -a "$OUT"
done

echo
echo "written: $OUT"

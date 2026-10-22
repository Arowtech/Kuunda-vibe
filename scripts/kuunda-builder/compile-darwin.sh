#!/usr/bin/env bash
set -euo pipefail

ARCH="${1:-arm64}"
case "$ARCH" in
	x64|arm64) ;;
	*) echo "Unsupported Darwin arch: $ARCH" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE_OPTIONS="--max-old-space-size=8192"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export VSCODE_ARCH="$ARCH"
# npm ci downloads microsoft/ripgrep-prebuilt via the GitHub API (needs GITHUB_TOKEN in CI).

run() {
	echo "==> $*"
	"$@"
}

run npm ci
run npm run buildreact
run npm run gulp -- compile-build-without-mangling
run npm run gulp -- compile-extension-media
run npm run gulp -- compile-extensions-build
run npm run gulp -- minify-vscode
run npm run gulp -- "vscode-darwin-${ARCH}-min-ci"

APP_PARENT="$(cd "$ROOT/.." && pwd)/VSCode-darwin-${ARCH}"
if [[ ! -d "$APP_PARENT" ]]; then
	echo "Missing packaged app folder: $APP_PARENT" >&2
	exit 1
fi

APP_PATH="$(find "$APP_PARENT" -maxdepth 1 -name '*.app' -type d | head -n 1)"
if [[ -z "$APP_PATH" ]]; then
	echo "No .app in $APP_PARENT" >&2
	ls -la "$APP_PARENT" >&2
	exit 1
fi

mkdir -p "$ROOT/artifacts"
STAGE="$(mktemp -d)"
cp -R "$APP_PATH" "$STAGE/"
DMG="$ROOT/artifacts/KuundaVibe-darwin-${ARCH}-unsigned.dmg"
rm -f "$DMG"
hdiutil create -volname "Kuunda Vibe" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
rm -rf "$STAGE"
echo "Wrote $DMG"

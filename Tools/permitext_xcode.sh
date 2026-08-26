#!/bin/zsh

set -u
set -o pipefail

readonly script_dir="${0:A:h}"
readonly repository_root="${script_dir:h}"
readonly project_path="${repository_root}/NYC CC APP/NYC CC APP.xcodeproj"
readonly derived_data_path="/Users/randy/Library/Developer/Xcode/DerivedData/PermitextShared"
readonly storage_guard="${script_dir}/permitext_storage_guard.sh"
readonly build_lock="/private/tmp/permitext-xcode-wrapper.lock"

usage() {
  print 'Usage:'
  print '  ./Tools/permitext_xcode.sh test-simulator [xcodebuild arguments]'
  print '  ./Tools/permitext_xcode.sh build-simulator [xcodebuild arguments]'
  print '  ./Tools/permitext_xcode.sh test-physical <device-identifier> [xcodebuild arguments]'
  print '  ./Tools/permitext_xcode.sh archive [xcodebuild arguments]'
}

if [[ ! -d "$project_path" || ! -x "$storage_guard" ]]; then
  print -u2 'Permitext Xcode wrapper prerequisites are missing.'
  exit 2
fi

if ! mkdir "$build_lock" 2>/dev/null; then
  print -u2 'Another Permitext Xcode wrapper is already running. Refusing concurrent build output.'
  exit 3
fi

release_lock() {
  rmdir "$build_lock" 2>/dev/null || true
}
trap release_lock EXIT INT TERM

mkdir -p "$derived_data_path"

readonly action="${1:-}"
if (( $# > 0 )); then
  shift
fi

command_status=0
case "$action" in
  test-simulator)
    xcodebuild test \
      -project "$project_path" \
      -scheme permitext \
      -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
      -derivedDataPath "$derived_data_path" \
      -parallel-testing-enabled NO \
      -parallel-testing-worker-count 1 \
      -maximum-parallel-testing-workers 1 \
      CODE_SIGNING_ALLOWED=NO \
      "$@" || command_status=$?
    ;;
  build-simulator)
    xcodebuild build \
      -project "$project_path" \
      -scheme permitext \
      -configuration Debug \
      -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$derived_data_path" \
      CODE_SIGNING_ALLOWED=NO \
      "$@" || command_status=$?
    ;;
  test-physical)
    if (( $# == 0 )); then
      usage
      exit 2
    fi
    readonly device_identifier="$1"
    shift
    xcodebuild test \
      -project "$project_path" \
      -scheme permitext \
      -destination "platform=iOS,id=${device_identifier}" \
      -derivedDataPath "$derived_data_path" \
      -parallel-testing-enabled NO \
      -parallel-testing-worker-count 1 \
      -maximum-parallel-testing-workers 1 \
      "$@" || command_status=$?
    ;;
  archive)
    readonly archive_path='/private/tmp/permitext-current.xcarchive'
    if [[ -e "$archive_path" ]]; then
      print -u2 "Archive staging path already exists: $archive_path"
      print -u2 'Reuse/export it or remove it after confirming the previous build is live.'
      exit 4
    fi
    xcodebuild archive \
      -project "$project_path" \
      -scheme permitext \
      -configuration Release \
      -destination 'generic/platform=iOS' \
      -derivedDataPath "$derived_data_path" \
      -archivePath "$archive_path" \
      "$@" || command_status=$?
    if (( command_status == 0 )); then
      print "Archive created at $archive_path"
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac

release_lock
trap - EXIT INT TERM

if (( command_status == 0 )); then
  "$storage_guard" --clean || true
else
  "$storage_guard" --audit || true
fi

exit "$command_status"

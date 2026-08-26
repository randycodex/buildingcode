#!/bin/zsh

set -u
set -o pipefail

readonly mode="${1:---audit}"
readonly script_dir="${0:A:h}"
readonly repository_root="${script_dir:h}"
readonly xctest_devices_root='/Users/randy/Library/Developer/XCTestDevices'
readonly coredevice_delta_root='/Users/randy/Library/Containers/com.apple.CoreDevice.CoreDeviceService/Data/Library/Caches/AppInstallationBinaryDeltas'
readonly shared_derived_data='/Users/randy/Library/Developer/Xcode/DerivedData/PermitextShared'
readonly expected_repository='/Users/randy/Documents/X_CODING/Building Code'
readonly coredevice_limit_kib=$((8 * 1024 * 1024))
readonly compilation_cache_limit_kib=$((8 * 1024 * 1024))
readonly local_derived_data_limit_kib=$((1 * 1024 * 1024))
readonly current_epoch=$(date +%s)

if [[ "$mode" != '--audit' && "$mode" != '--clean' ]]; then
  print -u2 'Usage: ./Tools/permitext_storage_guard.sh [--audit|--clean]'
  exit 2
fi

if [[ "$repository_root" != "$expected_repository" || ! -e "$repository_root/.git" || ! -d "$repository_root/NYC CC APP/NYC CC APP.xcodeproj" ]]; then
  print -u2 'Storage guard repository validation failed. No cleanup performed.'
  exit 3
fi

size_kib() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    print 0
    return
  fi
  du -sk "$target" 2>/dev/null | awk '{print $1}'
}

is_older_than() {
  local target="$1"
  local seconds="$2"
  local modified_epoch
  modified_epoch=$(stat -f '%m' "$target" 2>/dev/null) || return 1
  (( current_epoch - modified_epoch >= seconds ))
}

active_xcode_operation() {
  local process_name
  for process_name in xcodebuild xctest devicectl codesign productbuild altool notarytool swift-build swiftc; do
    if pgrep -x "$process_name" >/dev/null; then
      print "$process_name"
      return 0
    fi
  done
  if pgrep -x Xcode >/dev/null; then
    print 'Xcode'
    return 0
  fi
  return 1
}

delete_validated_tree() {
  local target="$1"
  case "$target" in
    "$xctest_devices_root"/*|\
    "$coredevice_delta_root"/*|\
    /var/folders/*/T/XcodeDistPipeline.*|\
    /var/folders/*/T/permitext_*.xcdistributionlogs|\
    /var/folders/*/X/com.google.Chrome.code_sign_clone|\
    "$repository_root"/.DerivedData-*|\
    "$shared_derived_data"/CompilationCache.noindex)
      ;;
    *)
      print -u2 "Refusing unapproved cleanup target: $target"
      return 1
      ;;
  esac
  [[ -e "$target" ]] || return 0
  find "$target" -depth -delete
  print "Removed: $target"
}

audit_storage() {
  local local_derived_data_target
  print 'Permitext storage guard audit'
  print "Free space: $(df -h / | awk 'NR==2 {print $4}')"
  print "XCTest clone data: $(du -sh "$xctest_devices_root" 2>/dev/null | awk '{print $1}' || print '0B')"
  print "CoreDevice installation deltas: $(du -sh "$coredevice_delta_root" 2>/dev/null | awk '{print $1}' || print '0B')"
  print "Shared Permitext DerivedData: $(du -sh "$shared_derived_data" 2>/dev/null | awk '{print $1}' || print '0B')"
  while IFS= read -r -d '' local_derived_data_target; do
    print "Project-local DerivedData $(basename "$local_derived_data_target"): $(du -sh "$local_derived_data_target" 2>/dev/null | awk '{print $1}')"
  done < <(find "$repository_root" -mindepth 1 -maxdepth 1 -type d -name '.DerivedData-*' -print0)
}

audit_storage
if [[ "$mode" == '--audit' ]]; then
  exit 0
fi

active_process=$(active_xcode_operation || true)
if [[ -n "$active_process" ]]; then
  print "Cleanup skipped: active process $active_process"
  exit 0
fi

if [[ -d "$xctest_devices_root" ]]; then
  clone_targets=()
  clone_validation_failed=0
  while IFS= read -r -d '' clone_target; do
    if [[ ! -f "$clone_target/device.plist" ]]; then
      clone_validation_failed=1
      break
    fi
    clone_name=$(/usr/libexec/PlistBuddy -c 'Print :name' "$clone_target/device.plist" 2>/dev/null || true)
    clone_state=$(/usr/libexec/PlistBuddy -c 'Print :state' "$clone_target/device.plist" 2>/dev/null || true)
    if [[ "$clone_name" != Clone* || "$clone_state" != '1' ]]; then
      clone_validation_failed=1
      break
    fi
    clone_targets+=("$clone_target")
  done < <(find "$xctest_devices_root" -mindepth 1 -maxdepth 1 -type d -print0)

  if (( clone_validation_failed == 0 )); then
    for clone_target in "${clone_targets[@]}"; do
      delete_validated_tree "$clone_target"
    done
  else
    print 'XCTest clone cleanup skipped: validation was not conclusive.'
  fi
fi

user_cache_dir=$(getconf DARWIN_USER_CACHE_DIR)
user_var_root="${user_cache_dir%/C/}"
user_temp_root="${user_var_root}/T"
chrome_signing_clone="${user_var_root}/X/com.google.Chrome.code_sign_clone"

if [[ -d "$user_temp_root" ]]; then
  while IFS= read -r -d '' pipeline_target; do
    if is_older_than "$pipeline_target" $((30 * 60)); then
      delete_validated_tree "$pipeline_target"
    fi
  done < <(find "$user_temp_root" -mindepth 1 -maxdepth 1 -type d -name 'XcodeDistPipeline.*' -print0)

  while IFS= read -r -d '' log_target; do
    if is_older_than "$log_target" $((24 * 60 * 60)); then
      delete_validated_tree "$log_target"
    fi
  done < <(find "$user_temp_root" -mindepth 1 -maxdepth 1 -type d -name 'permitext_*.xcdistributionlogs' -print0)
fi

if [[ -d "$chrome_signing_clone" ]] && is_older_than "$chrome_signing_clone" $((6 * 60 * 60)) && ! pgrep -x codesign >/dev/null; then
  delete_validated_tree "$chrome_signing_clone"
fi

coredevice_size_kib=$(size_kib "$coredevice_delta_root")
if (( coredevice_size_kib >= coredevice_limit_kib )) && [[ -d "$coredevice_delta_root" ]]; then
  while IFS= read -r -d '' delta_target; do
    if is_older_than "$delta_target" $((24 * 60 * 60)); then
      delete_validated_tree "$delta_target"
    fi
  done < <(find "$coredevice_delta_root" -mindepth 1 -maxdepth 1 -type d -print0)
fi

compilation_cache="${shared_derived_data}/CompilationCache.noindex"
compilation_cache_size_kib=$(size_kib "$compilation_cache")
if (( compilation_cache_size_kib >= compilation_cache_limit_kib )); then
  delete_validated_tree "$compilation_cache"
fi

while IFS= read -r -d '' local_derived_data_target; do
  local_derived_data_size_kib=$(size_kib "$local_derived_data_target")
  if (( local_derived_data_size_kib < local_derived_data_limit_kib )) || ! is_older_than "$local_derived_data_target" $((24 * 60 * 60)); then
    continue
  fi
  if [[ ! -d "$local_derived_data_target/Build" || ! -d "$local_derived_data_target/Logs" || ! -d "$local_derived_data_target/ModuleCache.noindex" ]]; then
    print "Project-local DerivedData cleanup skipped: structure was not conclusive for $local_derived_data_target"
    continue
  fi
  open_file_report=$(lsof +D "$local_derived_data_target" 2>&1 || true)
  if [[ -n "$open_file_report" ]]; then
    print "Project-local DerivedData cleanup skipped: files are open in $local_derived_data_target"
    continue
  fi
  delete_validated_tree "$local_derived_data_target"
done < <(find "$repository_root" -mindepth 1 -maxdepth 1 -type d -name '.DerivedData-*' -print0)

print "Free space after cleanup: $(df -h / | awk 'NR==2 {print $4}')"

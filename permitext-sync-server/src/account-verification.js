import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useReverification } from "@clerk/react";
import { isReverificationHint } from "@clerk/shared/authorization-errors";
export {
  captureClerkDeletionIdentity,
  clerkDeletionVerification,
  requireCapturedClerkIdentity,
  removeCapturedClerkIdentity
} from "./account-verification-core.js";

class VerificationBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function VerificationRequest({ operation, onStart, onSuccess, onError }) {
  const started = useRef(false);
  const verifiedOperation = useReverification(operation);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onStart();
    verifiedOperation().then((result) => {
      if (isReverificationHint(result)) {
        throw new Error("Identity verification did not finish. No further deletion was attempted.");
      }
      onSuccess(result);
    }).catch(onError);
  }, [verifiedOperation, onStart, onSuccess, onError]);
  return null;
}

// The workspace is plain JavaScript. Mount the supported Clerk React hook only
// while an account operation needs it, reusing the already loaded Clerk object.
// Passwords, verification codes, factor selection and retries stay in Clerk's UI.
export async function runReverifiedClerkOperation({ clerk, publishableKey, operation }) {
  if (!clerk?.loaded || typeof clerk.__internal_openReverification !== "function") {
    throw new Error("Secure identity verification is unavailable. Reload and try again.");
  }
  const host = document.createElement("div");
  host.hidden = true;
  document.body.append(host);
  const root = createRoot(host);
  let startupTimeout;
  try {
    return await new Promise((resolve, reject) => {
      startupTimeout = window.setTimeout(() => reject(new Error(
        "Secure identity verification could not open. Reload and try again."
      )), 15000);
      root.render(React.createElement(VerificationBoundary, { onError: reject },
        React.createElement(ClerkProvider, { Clerk: clerk, publishableKey },
          // The supplied instance is already loaded. Waiting for ClerkLoaded
          // can miss its earlier ready event when this lazy provider mounts.
          React.createElement(VerificationRequest, {
            operation,
            onStart: () => window.clearTimeout(startupTimeout),
            onSuccess: resolve,
            onError: reject
          })
        )
      ));
    });
  } finally {
    window.clearTimeout(startupTimeout);
    root.unmount();
    host.remove();
  }
}

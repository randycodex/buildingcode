# Assistant conversation scope

The web Assistant uses only exact passages added to the conversation, explicitly selected project context/facts, attached Note snapshots, comments, and active conversation messages. Adding or changing material never submits a question or invokes a provider. A user-entered question and explicit Send action begin analysis.

Included material is visible in the Assistant's left rail above conversation history. Context (description/address) starts off. Facts can be individually selected, all selected, or cleared. Notes and comments are user material, not enacted authority. The picker saves its selection before sending is enabled. Inputs are saved independently for each conversation; changing projects does not inherit another conversation's material.

The persisted `assistantScope` selects the server's `conversation_only` mode. It bypasses property lookup, corpus discovery, embeddings, open investigation, cross-reference expansion and repair retrieval. Full source text may be read locally to validate a selected passage, but only the exact selected text reaches the model. Existing generation, spend reservation, citation binding, independent semantic verification and immutable-answer storage remain in use. Untrusted attachment bodies are input data, not provider instructions. Selected facts exclude unrelated carrier/source text.

Adding material preserves the active discussion. Removing or replacing material starts a new inference context so earlier answers and facts cannot reintroduce removed inputs; the visible historical messages remain. Stale updates and stale retries are rejected. Project moves clear the selected context/facts/material snapshots, and project access is checked before answering.

Older web conversations activate the new boundary when opened through the material control or submitted from the updated web client. Their previous answers remain historical. Native/legacy API callers retain their existing Research behavior unless they explicitly activate the new mode. No model/configuration migration or paused retrieval experiments are included.

Verification: `npm run test:assistant-scope` uses isolated synthetic file stores, rejects external retrieval calls and uses provider doubles for generation/verification. It covers no response on adding material, context on/off, all/selected facts, Note snapshots, exact selected evidence, removal/history isolation, stale writes/retries, private carrier text exclusion, comment-only answers, and bounded missing-source answers. These tests do not establish real-model answer quality or a latency improvement.

This change is for local review. It has not been pushed or deployed.

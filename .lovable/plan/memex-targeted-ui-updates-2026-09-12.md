# MemeX targeted UI updates

## Scope
- Add an **Enable Tax** control directly below **Burn LP tokens on launch**.
- When enabled, reveal a required master fee-wallet field and save that configuration with the launched token.
- Block deployment with a clear validation message if tax is enabled without a valid wallet.
- Restyle the Transactions table to closely match the supplied reference: compact toolbar, richer asset rows, activity/balance columns, per-row airdrop action, and pagination styling.
- Replace only the Settings **Fee wallet** area with the supplied multi-network receiving-wallet design, including auto-receive, connected-wallet detection, editable network rows, add-network, and save behavior.

## Technical details
- Extend the existing browser-persisted token and settings models without changing the rest of the app workflow.
- Reuse the current semantic dark/green design tokens and existing controls.
- Keep current launch, airdrop, history, account, and workspace-reset behavior intact.
- Verify launch validation, settings save/edit controls, transactions filtering, row actions, and mobile/desktop presentation.

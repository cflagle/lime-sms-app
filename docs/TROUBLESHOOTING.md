# Troubleshooting Runbook

## Messages Not Sending

1.  **Check Master Switch**: Go to Settings and ensure "Sending Enabled" is ON.
2.  **Check Time Window**: Are you within 8am - 8pm local time?
3.  **Check Logs**:
    -   Cloud Run Logs: `Moving window check...` or `Daily limit reached...`
    -   DB: Check `SentLog` table for recent entries.

## Common Errors

### "Daily limit reached"
-   **Cause**: User has received max messages for the day (e.g., 2 per brand).
-   **Fix**: Wait for tomorrow or increase `dailyLimitPerUser` in Settings.

### "No suitable message found"
-   **Cause**: All active messages are either on cooldown or have been seen recently.
-   **Fix**: Add new messages or reduce `cooldownDays`.

### "Subscriber not ACTIVE using Lime Check"
-   **Cause**: The real-time check against Lime Cellular failed (User opted out externally).
-   **Action**: No action needed. System correctly marked user as `OPTOUT`.

## Debugging Tools

Run these scripts locally to diagnose:

-   `npm run diagnose`: Checks overall system state.
-   `npm run verify-limits`: Verifies daily limit logic.
-   `node scripts/check-specific-numbers.js`: Check status of a specific phone number.

# Application Safeguards & Constraints 🛡️

This system is built with a "Safety First" architecture to ensure compliance with TCPA regulations and to protect your sender reputation.

---

## 1. Global Safety Switches 🚦

| Setting | Function | Default |
| :--- | :--- | :--- |
| **Master Switch** | Currently controlled via `AppConfig.sendingEnabled`. If `OFF`, the worker skips the entire queue. No messages are sent. | `OFF` (Safe Mode) |
| **Dry Run Mode** | `AppConfig.dryRunMode`. When `ON`, the system simulates logic, logs to the console, and creates DB logs but **never calls the Lime API**. | `ON` (Testing) |
| **Global Daily Cap** | A hard limit on the total SMS sent by the system in 24 hours (e.g., 50,000). Once reached, the worker stops processing the queue until midnight. | `0` (Unlimited) |

---

## 2. Compliance Constraints (Legal) ⚖️

### Timezones (TCPA)
*   **Rule**: Messages are ONLY sent between **8:00 AM and 8:00 PM** local time.
*   **Derivation**: The system automatically detects the user's timezone based on their **Phone Number Area Code**.
*   **Fallback**: If the area code is unknown, it defaults to `America/New_York` (EST).

### Opt-In Verification
*   **Pre-Flight Check**: Immediately before sending, the system queries the `Lime Cellular API` to verify the number is still opted-in.
*   **Auto-Clean**: If Lime reports a user is opted-out, we mark them as `OPTOUT` in our database and **prevent** the send.

---

## 3. Frequency & Pacing (User Experience) 📉

These rules prevent "spamming" users and ensure better engagement.

| Rule | Description | Logic |
| :--- | :--- | :--- |
| **Engagement Window** | Only messages users who have interacted recently. | Defaults to `90 Days`. Users strictly outside this window are skipped. |
| **Daily User Cap** | Max messages a single user can receive per day. | Defaults to `2` per day. |
| **Minimum Interval** | Enforced gap between messages to the same user. | Default `1 hour`. (If you receive a message at 10:00, you cannot receive another until 11:00). |
| **Brand Isolation** | Limits are tracked separately for `WSWD` and `TA` brands. | Ensures one brand doesn't use up the user's daily "quota" if strictly configured. |

---

## 4. Message & Campaign Limits 🔁

*   **Message Cooldown**: Once a user receives "Message A", they cannot receive "Message A" again for `14 days` (configurable per message).
*   **Campaign Frequency**: Users can only receive `N` messages from a specific Campaign per week (e.g., "Max 2 messages from the 'Welcome Series' per week").

---

## 5. Segment & Targeting Rules 🎯

*   **Active Segment**: If an `activeSegmentId` is set in the configuration, the worker **filters** the queue to only process members of that segment. Everyone else is ignored.
*   **Test Mode**: If enabled, the worker **filters** the queue to ONLY process the specific phone numbers listed in `testNumbers`. Real subscribers are ignored.

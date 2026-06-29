# PRD: КМБ Video Chat

**Version:** 2.0
**Date:** June 4, 2026
**Status:** Ready for Development

---

## 1. Introduction / Overview

КМБ Video Chat is a group video calling web application for up to four participants per call, with a built-in text chat (including image and file attachments) and screen sharing. It follows a host/guest model: a user starts a call from the landing page, becomes the host, and receives a private host link plus a shareable participant link. Guests open the participant link, enter a name, and join. No accounts, no registration.

The host owns the room lifecycle: the host can copy the participant link, share their screen, remove a guest, and end the call. When the host ends the call — or leaves and does not return within a short grace period — the call ends for everyone. Each "Start a call" creates an independent room, so multiple calls can run in parallel. Everything is ephemeral: chat messages and attachments exist only while the room is alive and are gone once it ends.

This PRD focuses exclusively on user-facing behavior, flows, and interactions. Architecture, infrastructure, CI/CD, and deployment are out of scope of this document and are handled separately.

---

## 2. Goals

- Provide a complete, working group video call for up to four people, started in one click and shared via a link, with zero setup for participants — no accounts, no downloads, no plugins.
- Define every user-facing interaction with enough precision that a developer can build the entire frontend and user experience from this document alone.
- Give the host clear control of the call: copy the invite link, remove a guest, and end the call.
- Deliver a built-in text chat alongside the video grid, including image and file attachments within defined size and count limits.
- Allow any participant to share their screen, one at a time.
- Let each participant adapt the interface with a Dark/Light theme switch and an English/Russian language switch.

---

## 3. Target Audience

**Primary — Developers:**
The development team building this application as a learning/demo project. They use this PRD as the blueprint for the entire frontend and user experience.

**Secondary — End users of the resulting application:**
Any person who needs to start or join a quick, small group video call without creating an account. They are non-technical, expect the experience to "just work," and access the app via a supported desktop web browser.

**This product is NOT for:**
- Calls with more than four participants.
- Hosts who need to approve guests before entry (no waiting room / admission queue).
- Users who need accounts, persistent call history, or content stored after a call.
- Moderation beyond the host's ability to remove a guest and end the call (no co-hosts, no per-participant remote mute).
- Mobile-first usage (the product targets desktop browsers; see Constraints).

---

## 4. User Stories + Acceptance Criteria

### US-1: Start a New Call (Host)

**As a** user, **I want to** start a new call from the landing page **so that** I can host a conversation and invite others.

**Acceptance Criteria:**

```
Given the user is on the landing page
When the user clicks "Start a call"
Then the system creates a new room with a unique host URL and a separate participant URL
And the user is navigated to the pre-join screen as the host
And the host URL (containing the secret host token) is shown in the browser address bar
```

```
Given the user clicks "Start a call"
When room creation fails (server unavailable)
Then the landing page shows an inline message: "Unable to start a call right now. Please try again."
And the "Start a call" button remains enabled for retry
```

---

### US-2: Preview Camera and Microphone Before Joining

**As a** user (host or guest), **I want to** see myself and choose whether to enter with camera and microphone on or off **so that** I control how I appear before anyone sees or hears me.

**Acceptance Criteria:**

```
Given the user is on the pre-join screen
When the browser permission prompt for camera and microphone appears
And the user grants both permissions
Then the pre-join screen displays a live, mirrored self-preview
And the camera toggle is shown as "on" by default
And the microphone toggle is shown as "on" by default
And the user can turn the camera off before entering — the self-preview is replaced with the microphone-state icon (unmuted or muted) centered on a dark background (no avatar; the name is entered in the field below and is not shown in the preview)
And the user can turn the microphone off before entering — the microphone toggle shows the "off" state
And an "Enter call" button (for host) or "Join" button (for guest) is shown
```

```
Given the user is on the pre-join screen
When the user denies camera permission
Then the self-preview shows the microphone-state icon centered on a dark background (no avatar)
And the camera toggle is shown as "off" and disabled (greyed out)
And a message is displayed below the preview: "Camera access was denied. You can enable it in your browser settings."
And the user can still enter the call without camera
```

```
Given the user is on the pre-join screen
When the user denies microphone permission
Then the microphone toggle is shown as "off" and disabled (greyed out)
And a message is displayed below the preview: "Microphone access was denied. You can enable it in your browser settings."
And the user can still enter the call without microphone
```

```
Given the user is on the pre-join screen
When the user denies both camera and microphone permissions
Then the self-preview shows the microphone-state icon (muted) centered on a dark background (no avatar)
And both toggles are shown as "off" and disabled (greyed out)
And a single message is displayed: "Camera and microphone access was denied. You can enable them in your browser settings."
And the user can still enter the call
```

---

### US-3: Share the Call Link (Host)

**As a** host, **I want to** copy the participant link **so that** I can invite people to my call.

**Acceptance Criteria:**

```
Given the host is in the call
When the host clicks "Copy link"
Then the participant URL (without the host token) is copied to the clipboard
And a brief confirmation appears near the button: "Link copied!"
And the confirmation disappears after 2 seconds
```

```
Given the host clicks "Copy link"
When the browser denies clipboard access
Then an inline message appears near the button: "Unable to copy. Please copy the link from the address shown below:"
And the participant URL is shown as selectable text
```

```
Given a guest is on the pre-join screen or in the call
Then the "Copy link" button is not visible to the guest
```

---

### US-4: Join an Existing Call via Link (Guest)

**As a** guest, **I want to** join a call by opening the link I received and entering my name **so that** I can connect with the host and other guests.

**Acceptance Criteria:**

```
Given the guest has a valid participant URL
And the call has fewer than 4 participants
When the guest opens the URL
Then the guest is navigated to the pre-join screen (camera/mic preview and permissions as in US-2)
And the guest enters a valid name and clicks "Join"
Then the guest is placed into the call
And the guest's own tile is mirrored and labeled "<name> (You)"; other tiles are labeled with their names
And the guest sees the chat history accumulated while the room has been alive
```

```
Given the guest has a valid participant URL
And the call already has 4 participants
When the guest opens the URL
Then the guest sees a full-screen message: "This call is full. Only four participants can join at a time."
And a "Back to home" button is shown
And the guest does not reach the pre-join screen
```

```
Given the guest has a participant URL for a room that has ended
When the guest opens the URL
Then the guest sees a full-screen message: "This call has ended."
And a "Start a new call" button is shown, linking to the landing page
```

```
Given the guest has a participant URL that matches no existing or previous room, or has an invalid format
When the guest opens the URL
Then the guest sees a full-screen message: "This call was not found. The link may be incorrect or expired."
And a "Start a new call" button is shown, linking to the landing page
```

---

### US-5: See and Hear Other Participants

**As a** participant, **I want to** see and hear everyone else in the call **so that** we can have a group conversation.

**Acceptance Criteria:**

```
Given the user is in the call
Then every participant (including the user) is shown as a video tile in the grid
And each tile is labeled with the participant's name; the user's own tile is labeled "<name> (You)"
And audio from every other participant plays through the user's default audio output device
And the grid layout adapts to the participant count:
  - 1 participant: one tile fills the available area
  - 2 participants: two equal tiles side by side (left / right)
  - 3 participants: two tiles on the top row, one centered tile on the bottom row
  - 4 participants: a 2×2 grid
```

```
Given the user is in the call
When another participant turns their camera off
Then that participant's tile shows, on a dark background, the participant's microphone-state icon (unmuted or muted) centered above their name — no generic avatar is shown
And the tile keeps its position and dimensions, with the name shown centered beneath the microphone icon
```

```
Given the user is in the call
When another participant turns their microphone off
Then a muted-microphone icon is shown on that participant's tile
And no audio is received from that participant
```

```
Given the user is in the call
Then every participant on the call has a visible name label on their tile at all times
And this holds in every layout — the 1/2/3/4 grid and the thumbnail strip shown during screen sharing
And the local participant's label is "<name> (You)"
```

---

### US-6: Toggle My Camera During the Call

**As a** participant, **I want to** turn my camera on or off during the call **so that** I control when others see me.

**Acceptance Criteria:**

```
Given the user is in the call with the camera on
When the user clicks the camera toggle
Then the user's video stops transmitting
And the user's own tile switches to a dark background showing the microphone-state icon (unmuted or muted) centered above the name "<name> (You)" — no generic avatar is shown
And the camera toggle changes to the "off" state (camera icon with a diagonal strikethrough)
And every other participant sees this microphone-icon-and-name view in place of the user's video
```

```
Given the user is in the call with the camera off
When the user clicks the camera toggle
Then the user's video resumes transmitting
And the user's own tile shows the live mirrored camera feed
And the camera toggle returns to the "on" state
And every other participant sees the user's live video again
```

```
Given the user denied camera permission on the pre-join screen
When the user is in the call
Then the camera toggle is shown as "off" and disabled (greyed out)
And the user cannot turn the camera on from within the call
```

---

### US-7: Toggle My Microphone During the Call

**As a** participant, **I want to** mute or unmute my microphone during the call **so that** I control when others hear me.

**Acceptance Criteria:**

```
Given the user is in the call with the microphone on
When the user clicks the microphone toggle
Then the user's audio stops transmitting
And the microphone toggle changes to the "off" state (microphone icon with a diagonal strikethrough)
And a muted-microphone icon appears on the user's own tile for everyone (in the tile corner when the camera is on, or centered above the name when the camera is off, per FR-14)
```

```
Given the user is in the call with the microphone off
When the user clicks the microphone toggle
Then the user's audio resumes transmitting
And the microphone toggle returns to the "on" state
And the muted-microphone icon is removed from the user's tile (if the camera is off, the centered icon switches to the unmuted microphone state per FR-14)
```

```
Given the user denied microphone permission on the pre-join screen
When the user is in the call
Then the microphone toggle is shown as "off" and disabled (greyed out)
And the user cannot turn the microphone on from within the call
```

---

### US-8: Share My Screen

**As a** participant, **I want to** share my screen **so that** I can present content to everyone in the call.

**Acceptance Criteria:**

```
Given the user is in the call
And no one is currently sharing a screen
When the user clicks "Share screen"
And the browser screen-selection prompt appears and the user picks a screen, window, or tab
Then the shared content is shown as the large main area for every participant, including the sharer (the sharer sees their own shared content in the main area exactly as other participants do)
And the shared content is shown in full within the main area — scaled to fit with its aspect ratio preserved and never cropped; if its proportions differ from the area, neutral margins fill the remaining space (identical for the sharer and viewers)
And the large main area is labeled: "<name> is sharing their screen" for other participants, and "You are sharing your screen" for the sharer
And the sharer's camera keeps transmitting: the sharer now sends two streams — the screen-share stream (shown in the main area) and their camera stream (shown in the thumbnail strip)
And all participant video tiles (including the sharer's own camera tile) move into a horizontal thumbnail strip
And each thumbnail keeps its name label (the sharer's own thumbnail is labeled "<name> (You)"), keeps its camera-off representation (the microphone-state icon centered above the name, no avatar) and its muted-microphone indicator, and follows the same order as the grid (host first, then guests in join order)
And the sharer sees a "Stop sharing" control
```

```
Given a participant is already sharing a screen
Then the "Share screen" control is disabled for every other participant
And hovering it shows a tooltip: "Someone is already sharing their screen"
```

```
Given the user is sharing a screen
When the user clicks "Stop sharing" (or ends sharing from the browser's own control)
Then the shared area is removed
And the layout returns to the participant grid for the current count (US-5)
And the "Share screen" control becomes available to all participants again
```

```
Given the user clicks "Share screen"
When the user cancels the browser prompt or the browser denies screen capture
Then no screen is shared and the layout is unchanged
And an inline message appears above the controls bar: "Unable to share your screen. Please check your browser permissions."
And the message auto-dismisses after 4 seconds
```

---

### US-9: Use the Text Chat

**As a** participant, **I want to** send and read text messages during the call **so that** I can communicate without interrupting the conversation.

**Acceptance Criteria:**

```
Given the user is in the call
Then a chat button is displayed in the bottom-right corner
When the user clicks the chat button
Then the chat panel opens on the right side of the screen
And the video area (grid or shared-screen view) shrinks to the remaining width so that nothing is overlapped by the chat panel
And the panel shows all messages exchanged while the room has been alive, in chronological order
And each message shows the sender's name and the send time in HH:MM (24-hour) format
And the user can scroll the message list upward to read earlier messages
```

```
Given the chat panel is open
And the message input contains at least one non-whitespace character or at least one staged attachment
When the user clicks "Send" or presses Enter
Then the message is delivered to every participant in the call
And it is labeled with the user's name and the current time in HH:MM format
And the input and any staged attachments are cleared
And the message list scrolls to the newest message
```

```
Given the chat panel is open
And the message input is empty (no text and no staged attachment)
Then the "Send" button is disabled
And pressing Enter does not send a message
```

```
Given the user has the chat panel hidden
When a new message arrives from another participant
Then an unread indicator (a small dot) appears on the chat button
When the user opens the chat panel
Then the unread indicator is removed
```

---

### US-10: Share Images and Files in Chat

**As a** participant, **I want to** attach images and files to my chat messages **so that** I can share content with everyone in the call.

**Acceptance Criteria:**

```
Given the chat panel is open
When the user adds an attachment via the attach (paperclip) control
And the file is an allowed type and within size and count limits
Then the attachment is staged in the input area with its file name and a remove (×) control
And the user can stage up to 5 attachments for one message
```

```
Given the user sends a message containing attachments
Then each image attachment (PNG, JPEG, GIF, WebP) is shown in the chat as a thumbnail
And animated images (GIF and WebP) are shown as a still thumbnail in the chat (they do not animate in the message list) and animate only when opened in the full-size overlay
And clicking a thumbnail opens the image at full size in an overlay above the entire interface, centered and scaled to fit the viewport with its aspect ratio preserved (never enlarged beyond its native size)
And the background (chat and video) is dimmed with a semi-transparent layer that does not turn fully black, and the call keeps running behind the overlay
And the overlay has a close (×) button and can also be closed by pressing Esc or clicking the dimmed background
And the image overlay is view-only (no download control inside it)
And each non-image file (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP) is shown as a chip with the file name, size, and a download control
And clicking the chip's download control downloads the file via the browser (non-image files are not previewed in the app)
And every participant receives the same attachments
```

```
Given the user sends a message containing attachments
When the attachments are still being uploaded/sent
Then the message appears in the sender's chat with a "Sending…" status
And the status clears once delivery completes, or becomes "Not delivered" if it fails
```

```
Given the user selects a file of an unsupported type
Then the file is not staged
And an inline message appears below the input: "Unsupported file type."
```

```
Given the user selects a file larger than 10 MB
Then the file is not staged
And an inline message appears below the input: "File exceeds 10 MB."
```

```
Given the user tries to stage a 6th attachment for one message
Then the 6th file is not staged
And an inline message appears below the input: "You can attach up to 5 files per message."
```

```
Given a message with attachments fails to deliver (connection lost)
Then the message is shown in the sender's chat with an inline status "Not delivered"
And the staged attachments and text are retained so the user can resend
```

---

### US-11: Leave the Call (Guest)

**As a** guest, **I want to** leave the call **so that** I can disconnect without affecting the host or other guests.

**Acceptance Criteria:**

```
Given the guest is in the call
When the guest clicks "Leave"
Then the guest is navigated to a screen with the message: "You have left the call."
And a "Rejoin" button is shown, returning to the pre-join screen for the same room
And every remaining participant sees the guest's tile removed and the grid re-arranged
And the freed slot becomes available for a new guest
```

```
Given a guest's connection drops unexpectedly (tab close, browser crash, network loss)
Then the guest is treated as having left
And every remaining participant sees the tile removed and the grid re-arranged
And the freed slot becomes available; no grace period applies to guests
```

---

### US-12: End the Call (Host)

**As a** host, **I want to** end the call **so that** the room closes and the link stops working.

**Acceptance Criteria:**

```
Given the host is in the call
When the host clicks "End call"
Then the host is navigated to the landing page
And the room is destroyed and the participant URL becomes permanently inactive
And every guest's call is terminated immediately and each guest sees: "The host has ended the call." with a "Back to home" button
And any later visit to the participant URL shows "This call has ended."
```

---

### US-13: Remove a Guest (Host)

**As a** host, **I want to** remove a guest from the call **so that** I can manage who is in the room.

**Acceptance Criteria:**

```
Given the host is in the call with at least one guest
Then the host sees a "Remove" control on each guest's tile, revealed on hover or keyboard focus
When the host activates "Remove" for a guest
Then a confirmation dialog appears with the text "Remove <name> from the call?"
And the dialog has a "Remove" button (red, primary) and a "Cancel" button
And no participant is removed until the host confirms
```

```
Given the host has opened the remove-confirmation dialog for a guest
When the host clicks "Remove" in the dialog
Then the dialog closes and that guest is removed from the call
And the guest sees a full-screen message: "You were removed from the call by the host." with a "Back to home" button
And every remaining participant sees the guest's tile removed and the grid re-arranged
And the freed slot becomes available
```

```
Given the host has opened the remove-confirmation dialog for a guest
When the host clicks "Cancel"
Then the dialog closes and no one is removed
And the call continues unchanged
```

```
Given the host has opened the remove-confirmation dialog for a guest
When that guest leaves or disconnects before the host confirms
Then the dialog closes automatically (there is no longer anyone to remove)
And the call continues with the updated participant grid
```

```
Given a guest has been removed by the host
When that guest reopens the same participant URL
Then the guest reaches the pre-join screen and may rejoin if a slot is free (removal does not block rejoining)
```

---

### US-14: Host Reconnects After Unexpected Disconnection

**As a** host, **I want to** return to my call if my tab closes or my connection drops **so that** a technical hiccup does not end the call.

**Acceptance Criteria:**

```
Given the host is in the call
When the host's connection drops unexpectedly (browser crash, tab close, network loss)
Then the room enters a 60-second grace period
And each guest sees an overlay on the call screen: "The host lost connection. Waiting for them to return..."
And a countdown is shown to guests, updating every second (e.g., "Reconnecting... 47s")
And the overlay is informational only — guests can continue to see and hear one another and use the chat while they wait
```

```
Given the room is in the 60-second grace period
When the host reopens the host URL (from history or the address bar)
Then the host reaches the pre-join screen for the same room and, on entering, the call resumes
And the guests' waiting overlay disappears
```

```
Given the room is in the 60-second grace period
When 60 seconds elapse without the host reconnecting
Then the room is destroyed and the participant URL becomes permanently inactive
And each guest sees a full-screen message: "The host has disconnected and the call has ended." with a "Back to home" button
```

---

### US-15: Switch the Theme

**As a** user, **I want to** switch between a dark and a light theme **so that** I can use the interface comfortably.

**Acceptance Criteria:**

```
Given the user is on any screen of the app
Then a theme toggle (sun/moon icon) is shown in the top-right corner
And the theme is Dark by default
When the user clicks the theme toggle
Then the entire interface switches between Dark and Light immediately, on all screens, for the current session
```

```
Given the user has switched the theme
When the user reloads the page
Then the chosen theme is retained (the choice persists for the current browser session)
```

```
Given the user has switched the theme
When the user closes the browser and opens the app in a new browser session
Then the theme resets to Dark (the choice is not persisted across browser sessions)
```

---

### US-16: Switch the Language

**As a** user, **I want to** switch the interface language between English and Russian **so that** I can read the interface in my preferred language.

**Acceptance Criteria:**

```
Given the user is on any screen of the app
Then a language selector is shown in the top-right corner
And the language is English by default
When the user selects Russian
Then all interface text switches to Russian immediately, on all screens, for the current session
And chat messages that were already sent keep their original text (message content is not translated)
```

```
Given the user has switched the language
When the user reloads the page
Then the chosen language is retained (the choice persists for the current browser session)
```

```
Given the user has switched the language
When the user closes the browser and opens the app in a new browser session
Then the language resets to English (the choice is not persisted across browser sessions)
```

---

### US-17: Navigate the Landing Page

**As a** user, **I want to** see a clear landing page when I open the app **so that** I immediately understand what to do.

**Acceptance Criteria:**

```
Given the user navigates to the app's root URL
Then the landing page displays:
  - The app name/logo
  - A brief tagline (e.g., "Group video calls for up to four people. No sign-up required.")
  - A single prominent "Start a call" button
  - The theme toggle and language selector in the top-right corner
  - No other navigation, menus, or links
```

---

## 5. Functional Requirements

### Room Creation and Lifecycle

**FR-1** [Must] The system shall create a new room when a user clicks "Start a call", with two distinct URLs: a host URL containing a secret host token, and a participant URL without the token.
- Success: The user is navigated to the pre-join screen as host; the host URL is in the address bar.
- Error — creation fails (server unavailable): The landing page shows "Unable to start a call right now. Please try again."; the "Start a call" button stays enabled.

**FR-2** [Must] The system shall enforce a maximum of 4 concurrent participants per room (1 host + up to 3 guests).
- Success (fewer than 4): The guest proceeds through pre-join and joins.
- Full on open (4 present): The guest sees "This call is full. Only four participants can join at a time." with a "Back to home" button and does not reach pre-join.
- Full at entry time (the room reaches 4 while the guest is on the pre-join screen): On clicking the entry button, the guest is not admitted and the pre-join screen is replaced by the full-call screen with the same message and "Back to home" button.

**FR-3** [Must] The system shall destroy a room immediately when the host clicks "End call", making the participant URL permanently inactive.
- Success: Host is sent to the landing page; each guest sees "The host has ended the call." with "Back to home"; later visits to the participant URL show "This call has ended."

**FR-4** [Must] The system shall start a 60-second grace period when the host disconnects unexpectedly, and shall destroy the room if the host does not return within it.
- During the wait: The host-disconnected overlay is informational; the guests' video, audio, and chat among themselves continue uninterrupted behind it. (Host-only controls are simply absent for guests, as always.)
- New guest during the wait: The participant link still admits a new guest while the room is in the grace period (subject to the 4-cap, FR-2); the new guest joins and sees the same host-disconnected waiting overlay.
- Success — host returns via the host URL within 60 seconds: The call resumes; the guests' waiting overlay is removed; the grace period is cancelled.
- Success — 60 seconds elapse: The room is destroyed; each guest sees "The host has disconnected and the call has ended." with "Back to home".

**FR-5** [Must] The system shall keep the room alive when a guest leaves (intentionally or unexpectedly) and shall free that guest's slot.
- Success: The guest's tile is removed for everyone; the grid re-arranges to the new count; no grace period applies to guests.

**FR-6** [Must] The system shall let the host remove any guest, gated by a confirmation step. The host shall see a "Remove" control on each guest's tile, revealed on hover or keyboard focus. Activating "Remove" on a guest's tile shall open a confirmation dialog ("Remove <name> from the call?") with a red "Remove" button and a "Cancel" button; the guest is removed only after the host confirms. On confirmation, the removed guest is disconnected and shown "You were removed from the call by the host." with a "Back to home" button; the freed slot becomes available.
- Success (confirm): The dialog closes, the guest leaves the call, and remaining participants see the grid re-arrange.
- Cancel: The dialog closes, no guest is removed, and the call continues unchanged.
- Target leaves first: If the targeted guest leaves or disconnects while the dialog is open, the dialog closes automatically and no action is taken.
- Note: Removal does not block the guest from rejoining the same participant URL while the room is alive (re-entry follows FR-2).

### Role Assignment and Link Sharing

**FR-7** [Must] The system shall assign the host role to a user who connects with a valid host URL (correct host token for that room).
- Success: The user enters as host with host controls (End call, Copy link, Remove guest, camera, microphone, screen share, chat).
- Error — host token invalid or unmatched: The user sees "This call was not found. The link may be incorrect or expired." with "Start a new call".

**FR-8** [Must] The system shall assign the guest role to a user who connects with a valid participant URL (no host token).
- Success: The user enters as guest with guest controls (Leave, camera, microphone, screen share, chat).

**FR-9** [Must] The system shall show the "Copy link" button only to the host, on the in-call screen, and shall copy the participant URL (without the host token).
- Success: "Link copied!" appears for 2 seconds.
- Error — clipboard access denied: "Unable to copy. Please copy the link from the address shown below:" with the participant URL shown as selectable text.

### Pre-join Screen

**FR-10** [Must] The system shall present a pre-join screen with: a self-preview area, a camera toggle (default on), a microphone toggle (default on), a name input, the entry button ("Enter call" for host, "Join" for guest), the theme toggle, and the language selector.
- Success: All listed elements are visible before entering the call.

**FR-11** [Must] The system shall request browser camera and microphone permissions when the pre-join screen loads, and shall handle each outcome with one defined result.
- Both granted: Live mirrored self-preview, filling the preview area with a "cover" fit (matching the in-call tiles, FR-13); both toggles default to "on".
- Camera denied, microphone granted: Self-preview shows the microphone-state icon centered (microphone on), no avatar; camera toggle is "off" and disabled; message "Camera access was denied. You can enable it in your browser settings."; microphone toggle is "on".
- Camera granted, microphone denied: Self-preview is shown; microphone toggle is "off" and disabled; message "Microphone access was denied. You can enable it in your browser settings."; camera toggle is "on".
- Both denied: Self-preview shows the microphone-state icon centered (microphone off), no avatar; both toggles are "off" and disabled; message "Camera and microphone access was denied. You can enable them in your browser settings."

Note: in the pre-join self-preview the participant's name is not shown over the icon (it is entered in the name field below); this is the only intended difference from the in-call camera-off tile (FR-14).

**FR-12** [Must] The system shall allow a user to enter the call with camera and/or microphone denied or turned off. No device permission shall be a precondition for entering.
- Success: The user enters; any denied device stays off and its toggle stays disabled for the whole session.

### In-call Video and Audio

**FR-13** [Must] The system shall display one video tile per participant and apply the layout for the current count: 1 → single full-area tile; 2 → two equal tiles left/right; 3 → two tiles top row plus one centered tile bottom row; 4 → 2×2 grid. The local participant's tile shall be mirrored and labeled "<name> (You)"; other tiles shall be labeled with their participant's name. Every tile shall carry a visible name label in all layouts, including the thumbnail strip shown during screen sharing (FR-16); no participant on the call is ever shown without a name label. When a participant's camera is off, their name is shown centered beneath the microphone-state icon (FR-14) instead of in the tile corner. Each participant's video shall fill its tile using a "cover" fit — scaled to fill the tile with any overflow cropped, never letterboxed (no black bars) and never stretched out of proportion — in both the grid and the screen-share thumbnail strip.
- Success: The grid matches the count and updates whenever a participant joins, leaves, or is removed; name labels remain visible on every tile in the grid and in the screen-share thumbnail strip; each video fills its tile without black bars or distortion.

**FR-14** [Must] When a participant's camera is off, the system shall replace that participant's video with a dark background showing, centered, the participant's microphone-state icon (unmuted or muted) above their name (the local participant's own tile shows "<name> (You)"); no generic avatar icon shall be shown, and the tile shall keep its position and dimensions. When a participant's camera is on and their microphone is off, the system shall show a muted-microphone icon in the corner of that participant's tile.
- Success: On a camera-off tile the centered microphone icon reflects the current microphone state and updates as the participant toggles the microphone; on a camera-on tile the corner mute icon appears and clears as the participant toggles the microphone.

**FR-15** [Must] The system shall play the audio of every other participant through the user's default audio output device.
- Success: A participant with microphone on is audible to everyone else; a participant with microphone off transmits no audio.

### Screen Sharing

**FR-16** [Must] The system shall let any participant share their screen, with one active share at a time. While a share is active, the shared content is the large main area for all participants (including the sharer) and all participant video tiles move into a horizontal thumbnail strip. The shared content is shown in full within the main area — scaled to fit with its aspect ratio preserved and never cropped; neutral margins fill any remaining space when its proportions differ from the area (identical for the sharer and viewers). Note the fit differs by element: participant video tiles use "cover" (FR-13), while the shared screen uses "contain" so nothing of the shared content is cut off. The sharer's camera continues transmitting during the share: the sharer sends two streams — the screen-share stream (rendered in the main area) and their camera stream (rendered as their tile in the thumbnail strip). The large main area is labeled ("<name> is sharing their screen" for others; "You are sharing your screen" for the sharer). Every thumbnail keeps its name label, its camera-off representation (the microphone-state icon centered above the name, no avatar) and its muted-microphone indicator, and the same order as the grid (host first, then guests in join order).
- Success (start): After the user picks a screen/window/tab in the browser prompt, the shared content becomes the main area for everyone (including the sharer), the participant tiles move into the labeled thumbnail strip, and the sharer sees "Stop sharing".
- Blocked (someone already sharing): The "Share screen" control is disabled for other participants; its tooltip reads "Someone is already sharing their screen".
- Concurrent attempts: If two participants start sharing at nearly the same moment, the first share registered by the server becomes the active share; the other attempt is rejected, that participant's share does not start, and their control returns to the disabled "Someone is already sharing their screen" state.
- Success (stop): On "Stop sharing" (or ending via the browser's own control), the shared area is removed and the layout returns to the participant grid; "Share screen" becomes available to all.
- Error — prompt cancelled or capture denied: Nothing is shared, layout unchanged, and an inline message appears above the controls bar: "Unable to share your screen. Please check your browser permissions." (auto-dismisses after 4 seconds).
- Sharer departs: If the sharing participant leaves the call, is removed by the host, or (for the host) enters the disconnect grace period, the share ends automatically and the layout returns to the participant grid; "Share screen" becomes available again.
- Out of scope: System/shared-tab audio is not captured.

### In-call Controls

**FR-17** [Must] The camera toggle shall immediately stop or resume the local video. The "on" state shows a camera icon; the "off" state shows a camera icon with a diagonal strikethrough.
- Success (off): Local tile and all remote views show the centered microphone-state icon and name (no avatar); toggle shows "off".
- Success (on): Local tile and all remote views show live video; toggle shows "on".
- Error — camera cannot be (re)acquired: The toggle reverts to its previous state; an inline message appears above the controls bar: "Unable to access camera. Please check your device or browser settings." (auto-dismisses after 4 seconds).
- Disabled: If camera permission was denied, the toggle is "off" and disabled.

**FR-18** [Must] The microphone toggle shall immediately stop or resume the local audio. The "on" state shows a microphone icon; the "off" state shows a microphone icon with a diagonal strikethrough.
- Success (off): Audio stops; toggle shows "off"; a mute icon appears on the local tile for everyone.
- Success (on): Audio resumes; toggle shows "on"; the mute icon is removed.
- Error — microphone cannot be (re)acquired: The toggle reverts to its previous state; an inline message appears above the controls bar: "Unable to access microphone. Please check your device or browser settings." (auto-dismisses after 4 seconds).
- Disabled: If microphone permission was denied, the toggle is "off" and disabled.

**FR-19** [Must] The system shall show the "End call" button only to the host and the "Leave" button only to the guest. "End call" destroys the room (FR-3); "Leave" removes only the guest (FR-5) and shows the "You have left the call." screen with a "Rejoin" button. The "End call" button shall be visually distinct (red) and separated from adjacent controls by at least 24px.
- Success: Host taps "End call" → room destroyed; Guest taps "Leave" → guest exits, others unaffected.

**FR-20** [Must] The system shall show a tooltip on hover for the camera, microphone, screen-share, end/leave, and remove-guest (host) controls, stating the action and current state. Tooltip text: camera on → "Turn camera off"; camera off → "Turn camera on"; microphone on → "Mute microphone"; microphone off → "Unmute microphone"; screen share idle → "Share your screen"; screen share active (own) → "Stop sharing"; screen share blocked → "Someone is already sharing their screen"; host end → "End the call for everyone"; guest leave → "Leave the call"; remove guest → "Remove this guest".
- Success: Hovering a control shows its tooltip reflecting the current state.

**FR-21** [Must] The system shall place the in-call controls (camera toggle, microphone toggle, screen share, and end/leave) in a horizontal bar at the bottom center, the chat button in the bottom-right corner, the "Copy link" button (host only) within reach of the controls, and the theme toggle and language selector in the top-right corner. Controls shall remain visible for the entire call (no auto-hide).
- Success: All controls are visible and reachable at all times during the call.

### Text Chat

**FR-22** [Must] The chat button shall open and hide the chat panel. When open, the panel occupies the right side and the video area (grid or shared-screen view) shrinks to the remaining width so that nothing is overlapped; when hidden, the video area expands to full width.
- Success: Toggling the chat resizes the video area accordingly; chat and video never overlap. The open/hidden state is local to each participant.

**FR-23** [Must] The chat panel shall display all messages and attachments exchanged while the room has been alive, in chronological order, each labeled with the sender's name and the send time in HH:MM (24-hour) format, with upward scrolling to read earlier items.
- Success: New joiners see the existing history; new items append at the bottom and the list scrolls to the newest item on send/receive.
- Lifecycle: When the room is destroyed (host ends the call or the grace period expires), all messages and attachments are discarded and are not retained.

**FR-24** [Must] The system shall send a message to all participants when the user clicks "Send" or presses Enter, provided the message contains at least one non-whitespace character or at least one staged attachment; the input and staged attachments are then cleared.
- Success: The message (text and/or attachments) appears for all participants with the sender's name and time.
- Empty (no text and no attachment): The "Send" button is disabled and Enter does not send.
- In flight: While a message is being sent (notably one carrying attachments), it appears in the sender's chat with a "Sending…" status until it is delivered (the status then clears) or it fails.
- Error — delivery fails (connection lost): The message is shown in the sender's chat with an inline status "Not delivered"; its text and attachments are retained for resend.

**FR-25** [Should] The system shall show an unread indicator (a small dot) on the chat button when the chat panel is hidden and a new message arrives, and shall remove it when the panel is opened.
- Success: Dot appears on a new incoming message while hidden; dot clears on open.

### Chat Attachments

**FR-26** [Must] The system shall let a participant attach files to a chat message via an attach (paperclip) control, accepting images (PNG, JPEG, GIF, WebP) and files (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP), up to 10 MB per file and up to 5 attachments per message.
- Success: A valid file is staged in the input with its name and a remove (×) control.
- Error — unsupported type: The file is not staged; inline message "Unsupported file type."
- Error — over size: The file is not staged; inline message "File exceeds 10 MB."
- Error — over count: The extra file is not staged; inline message "You can attach up to 5 files per message."

**FR-27** [Must] The system shall render delivered image attachments (PNG, JPEG, GIF, WebP) as thumbnails and non-image files (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP) as a chip showing the file name, size, and a download control. Clicking an image thumbnail shall open the image at full size in an overlay above the entire interface (centered, scaled to fit the viewport with aspect ratio preserved, never enlarged beyond native size), with the background dimmed by a semi-transparent layer that does not turn fully black and the call still running behind it; the overlay shall have a close (×) button and shall also close on Esc or a click on the dimmed background. The image overlay is view-only (no in-overlay download). Animated images (GIF and WebP) are shown as a still thumbnail in the chat and animate only when opened in the full-size overlay. Clicking a non-image chip's download control shall download the file via the browser; non-image files are not previewed in the app.
- Success: Every participant sees the same thumbnails/chips; clicking a thumbnail opens the full-size overlay; clicking a chip's download control downloads the file.
- Accessibility: When the overlay opens, focus moves into it and returns to the originating thumbnail on close; the close button has an accessible label.
- Lifecycle: Attachments follow chat lifecycle (FR-23) and are discarded when the room is destroyed.

### Theme and Language

**FR-28** [Must] The system shall provide a theme toggle in the top-right corner that switches the entire interface between Dark (default) and Light immediately, on all screens. The choice shall be retained for the current browser session — it persists across page reloads and resets to Dark when a new browser session begins (after the browser is closed and reopened). On first load with no prior choice in the session, the theme is Dark.
- Success: Clicking the toggle switches theme app-wide at once; the choice persists across reloads within the session; a new browser session returns to Dark.

**FR-29** [Must] The system shall provide a language selector in the top-right corner that switches the interface between English (default) and Russian immediately, on all screens. Already-sent chat messages keep their original text. The choice shall be retained for the current browser session — it persists across page reloads and resets to English when a new browser session begins (after the browser is closed and reopened). On first load with no prior choice in the session, the language is English.
- Success: Selecting a language updates all interface text at once; message content is unchanged; the choice persists across reloads within the session; a new browser session returns to English.

### Landing Page and Browser Support

**FR-30** [Must] The landing page shall display the app name/logo, a brief tagline (e.g., "Group video calls for up to four people. No sign-up required."), a single "Start a call" button, and the theme toggle and language selector. No other navigation, menus, or links shall be present.
- Success: The landing page renders exactly these elements.

**FR-31** [Must] The system shall support the latest 2 major versions of Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge on desktop.
- Success: The app renders and functions on the supported browsers.
- Unsupported browser detected: The first screen the user opens (the landing page, or the pre-join screen for a guest arriving via a participant link) shows "Your browser may not support video calls. Please use the latest version of Chrome, Firefox, Safari, or Edge."

---

## 6. Input Field Validation Rules

| Field | Min | Max | Allowed format / values | Regex / pattern | Invalid input behavior | Notes |
|-------|-----|-----|------------------------|-----------------|------------------------|-------|
| Name (pre-join) | 2 chars | 30 chars | Unicode letters, digits, spaces, hyphen (-), apostrophe ('); leading/trailing whitespace trimmed before validation | `^[\p{L}\p{N} '\-]{2,30}$` (Unicode mode) | Empty or whitespace-only on entry → inline error below field: "Please enter your name". Length < 2 after trim → "Name must be 2–30 characters". Disallowed characters → "Name can contain only letters, numbers, spaces, hyphens and apostrophes". Input is capped at 30 characters. Error appears on the "Enter call"/"Join" click and clears on the next valid keystroke. | Required for both host and guest. Duplicate names allowed; "(You)" distinguishes the local user. Validated client-side and server-side. |
| Chat message text | 0 chars (if an attachment is present) / 1 char (text-only) | 1000 chars | Any Unicode text; leading/trailing whitespace trimmed before send | — (free text; no structural pattern) | "Send" is enabled when the input has at least one non-whitespace character or at least one staged attachment; otherwise it is disabled and Enter does not send. Input is capped at 1000 characters; a character counter appears at 900 characters showing the remaining count. | Plain text only (no rich text/markup). Validated client-side and server-side. |
| Chat attachment | — | 10 MB per file | Images: PNG, JPEG, GIF, WebP. Files: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP | — (validated by file extension and MIME type) | Unsupported type → not staged, inline "Unsupported file type.". Over 10 MB → not staged, inline "File exceeds 10 MB.". More than 5 per message → extra not staged, inline "You can attach up to 5 files per message." | Up to 5 attachments per message. Type and size validated client-side and server-side. Attachments are ephemeral (discarded when the room is destroyed). |

---

## 7. Empty States

| Screen / Component | Trigger condition | UI behavior | User-facing message | Available actions |
|--------------------|-------------------|-------------|---------------------|-------------------|
| In-call — host alone | The host is the only participant (no guest has joined yet, or all guests have left) | The host's own tile fills the available area with a centered overlay text; if the host is sharing their screen, the shared-screen layout applies and the overlay text remains visible as a notice | "Waiting for someone to join…" | "Copy link" remains visible and functional; all other controls remain functional |
| Chat panel — no messages | The chat panel is open and no messages have been sent during the current room | Centered message inside the empty panel | "No messages yet." | Message input, attach control, and "Send" remain available |
| Pre-join — self-preview (camera denied) | The user denied camera permission | Self-preview shows the microphone-state icon centered on a dark background (no avatar; name not shown in the preview) | "Camera access was denied. You can enable it in your browser settings." | The user can still enter the call |
| Pre-join — self-preview (both denied) | The user denied both camera and microphone permissions | Self-preview shows the microphone-state icon (muted) centered on a dark background (no avatar; name not shown in the preview) | "Camera and microphone access was denied. You can enable them in your browser settings." | The user can still enter the call |
| Full-call screen | A guest opens a participant URL when 4 participants are already present | Full-screen centered message on a neutral background | "This call is full. Only four participants can join at a time." | "Back to home" button linking to the landing page |
| Ended-call screen | A guest opens a participant URL for a room that has ended | Full-screen centered message on a neutral background | "This call has ended." | "Start a new call" button linking to the landing page |
| Invalid-link screen | A user opens a URL that matches no room or has an invalid format | Full-screen centered message on a neutral background | "This call was not found. The link may be incorrect or expired." | "Start a new call" button linking to the landing page |
| Host-disconnected overlay (guest view) | The host's connection drops unexpectedly | Informational overlay with a countdown over the call screen; the call UI remains visible and interactive behind it | "The host lost connection. Waiting for them to return..." with a countdown "Reconnecting... [seconds]s" (e.g., "Reconnecting... 47s"); if 60s elapse, transitions to "The host has disconnected and the call has ended." | Guests keep seeing/hearing one another and using chat while waiting; countdown updates every second; after 60s a "Back to home" button is shown |
| Remove-guest confirmation (host view) | The host activates "Remove" on a guest's tile | Modal confirmation dialog over the call screen; the call UI stays visible behind it | "Remove <name> from the call?" | "Remove" button (red) confirms and removes the guest; "Cancel" closes the dialog with no change |
| Removed-guest screen | The host confirms removal of the guest | Full-screen centered message on a neutral background | "You were removed from the call by the host." | "Back to home" button |
| Guest-left screen | The guest clicks "Leave" | Full-screen centered message on a neutral background | "You have left the call." | "Rejoin" button returning to the pre-join screen for the same room |
| Unsupported browser | The user opens the app in a browser outside the supported list | Message shown on the first screen the user opens (landing or pre-join) | "Your browser may not support video calls. Please use the latest version of Chrome, Firefox, Safari, or Edge." | The user may continue at their own risk |

---

## 8. Non-Functional Requirements

### Usability

**NFR-1** The application shall render correctly on desktop browser viewports of width ≥ 1024px. No horizontal scrolling shall occur at any supported viewport width. Mobile viewports are not a supported target (see Constraints).

**NFR-2** All interactive controls (buttons, toggles, language selector, attach control) shall be keyboard-navigable (Tab to focus, Enter/Space to activate) with visible focus indicators meeting WCAG 2.1 AA contrast requirements.

**NFR-3** All icon-only buttons (camera toggle, microphone toggle, screen share, end/leave, chat, attach, theme) shall have accessible labels (aria-label or equivalent) describing their function and current state.

**NFR-4** The interface shall be available in English (default) and Russian. All user-facing text strings shall be externalized (not hardcoded in component logic) so that additional languages can be added without code changes to components.

**NFR-5** The Dark theme shall be the default. Both Dark and Light themes shall meet WCAG 2.1 AA text-contrast requirements on all screens.

### Security

**NFR-6** The host token in the host URL shall be cryptographically random with at least 128 bits of entropy, to prevent guessing or enumeration.

**NFR-7** The room identifier in the participant URL shall be cryptographically random with at least 128 bits of entropy, to prevent guessing or enumeration.

**NFR-8** Anyone who opens a valid participant URL and provides a valid name may join if a slot is free; the product is anonymous and has no authentication. This open-link access model is an explicit product decision (see Risk Analysis).

**NFR-9** All communication between the client and the server shall occur over encrypted transport (HTTPS/WSS). Media streams shall use the encryption provided by the browser's real-time media stack by default.

**NFR-10** No participant-generated content shall be persisted after a room is destroyed: chat messages, attachments, and participant names are discarded when the room ends and are not stored by the application. A minimal marker that a room existed and has ended may be retained to serve the "This call has ended." screen and distinguish it from an unknown link; this marker contains no participant content. The user's Dark/Light theme and English/Russian language preference is a client-side UI setting retained only in the user's browser for the current session; it is not participant content and is not stored by the application server.

### Supportability

**NFR-11** All error and status messages shown to users shall be specific and actionable; generic "Something went wrong" messages shall not be used. Every error and status message is defined in this document.

**NFR-12** When the application cannot reach the server, it shall display "Unable to connect to the call service. Please check your internet connection and try again." on the current screen, and shall not show a blank screen, crash, or hang.

**NFR-13** When a participant's real-time media quality degrades (low bandwidth, packet loss), the application shall continue the call at reduced quality rather than disconnecting. No user-facing message is required for quality degradation.

---

## 9. Non-Goals (Out of Scope)

The following are intentionally excluded from this product:

1. **Host approval of entry / waiting room / admission queue** — guests with a valid link and a free slot join directly; the host does not admit or decline entrants. (Evaluated and intentionally excluded.)
2. **Calls with more than 4 participants.**
3. **User accounts, authentication, or registration** — the product is anonymous; access is by link only.
4. **Multiple hosts, co-hosts, or moderation beyond removing a guest and ending the call** — no per-participant remote mute or remote camera control.
5. **Blocking a removed guest from rejoining** — removal frees the slot but does not ban the guest from re-entering via the link while the room is alive.
6. **Screen-share audio** — system or shared-tab audio is not captured.
7. **Selecting a specific camera or microphone device** — the browser's default devices are used.
8. **Active-speaker highlighting.**
9. **Persistent chat history or attachment storage** — messages and attachments are discarded when the room ends.
10. **Persisting theme or language across browser sessions** — the choice is kept within a browser session (across reloads) but resets to defaults (Dark / English) when a new browser session begins.
11. **Reconnection or grace period for guests** — a dropped guest is treated as having left and rejoins manually. (Only the host has a grace period.)
12. **Call recording, virtual backgrounds, reactions, and emoji/rich-text formatting in chat** — live screen sharing is supported (FR-16), but recording it is not.
13. **Call history, logs, analytics, or an admin/management interface.**
14. **Mobile-optimized layout and native mobile apps** — desktop browsers only.
15. **Server-side scanning of uploaded files (e.g., antivirus)** — limited to type and size validation; recipients download at their own discretion.
16. **Infrastructure, CI/CD, and deployment** (including the CI and demo-server deployment task from the base requirements) — handled outside this document.

---

## 10. Assumptions

1. Users have a supported desktop web browser (latest 2 versions of Chrome, Firefox, Safari, or Edge) with support for real-time audio/video and screen capture in the browser.
2. Users have an internet connection sufficient for real-time group audio/video.
3. The host is also a participant: the host enters a name on the pre-join screen and appears in the grid like any other participant.
4. The self-preview and the local participant's own tile are mirrored; remote participants' tiles are not mirrored.
5. Video tiles are ordered by join order (host first, then guests in the order they joined), with the local participant included in the grid.
6. Opening or hiding the chat panel affects only the local user's view.
7. An unexpected disconnect is any connection loss that does not go through "End call" (host) or "Leave" (guest) — tab close, browser crash, network loss, device sleep.
8. The host URL in the browser address bar/history is the only way to reclaim the host role; if the host loses it, the room ends after the 60-second grace period.
9. The 60-second host grace period is measured server-side, from when the server detects the host's disconnect, and a reconnection within it cancels room destruction as an atomic operation.
10. Duplicate display names are permitted; the local user is distinguished by the "(You)" suffix.
11. When camera or microphone permission is denied, the corresponding control stays disabled for the whole session; the user must change the browser setting and reload to enable the device.
12. Chat messages are plain text plus attachments; no message editing or deletion is provided, and no links are specially rendered.
13. The application requires HTTPS in deployed environments for real-time media and encrypted transport; local development on localhost is exempt.
14. The base-requirements task "Configure CI and deploy app" is acknowledged but is a technical/infrastructure concern outside this behavioral PRD.

---

## 11. Constraints

1. **Desktop web only** — the supported target is desktop browsers at viewport width ≥ 1024px. Mobile layout is not in scope.
2. **Browser compatibility** — limited to the latest 2 major versions of Chrome, Firefox, Safari, and Edge.
3. **Maximum 4 participants per call** — a hard cap (1 host + up to 3 guests); additional guests are blocked with the full-call screen.
4. **One host per room** — exactly one host owns each room's lifecycle.
5. **No data storage** — no messages, attachments, names, or call content persist after a room ends; only a minimal "room ended" marker (with no participant content) may remain to serve the "This call has ended." screen. (The Dark/Light theme and English/Russian language preference is a client-side UI setting kept only in the browser within a session; it is not call content and is not covered by this constraint.)

---

## 12. Design Considerations

- **Visual style:** Clean, neutral, and unbranded — intended to be re-skinned with custom branding. Two themes: Dark (default) and Light.
- **Default call appearance:** Dark theme by default; the Light theme adjusts surfaces, text, and chrome while video tiles keep a dark backing for contrast. Video tiles use a "cover" fit — the feed fills the tile and any overflow is cropped, with no black bars or stretching.
- **Theme and language controls:** Together in the top-right corner on every screen. Theme is a sun/moon icon toggle; language is a compact EN / RU selector.
- **Landing page:** Vertically centered content — app name/logo, tagline, and "Start a call" button — with generous whitespace and no navigation bar.
- **Pre-join screen:** Centered layout with the self-preview prominent (same "cover" fit as the in-call tiles, so the user looks the same before and after entering); camera/microphone toggles, name field, and the entry button below it.
- **Controls bar:** Horizontal, bottom-center, semi-transparent dark backing over the video area, visible at all times. Icon-only buttons (camera, microphone, screen share, end/leave). The "End call" button is red and separated from other controls by at least 24px.
- **Screen-share layout:** Shared content occupies the large main area for everyone, including the sharer; the main area carries a label ("<name> is sharing their screen" for others; "You are sharing your screen" for the sharer). The shared screen is shown in full ("contain") — never cropped; neutral margins appear if its proportions differ from the area. (Video tiles use "cover"; the shared screen uses "contain".) All participant camera tiles — including the sharer's, whose camera keeps running — form a horizontal thumbnail strip below the main area, each tile keeping its name label and camera-off / mute indicators, ordered as in the grid. When the chat panel is open, the main area shrinks to the remaining width.
- **Chat:** A right-side panel toggled from a bottom-right button. Messages show sender name and HH:MM time; images render as thumbnails (click opens a full-size overlay viewer); files render as chips (name, size, download — click downloads). The input row has the attach (paperclip) control, the text input, and "Send"; staged attachments appear above the input with a remove control.
- **Image viewer (lightbox):** Clicking a chat image opens it full-size in a centered overlay above the whole UI; the background is dimmed with a semi-transparent layer (not fully black) and the call keeps running behind it. A close (×) button sits at the top corner; Esc and a click on the dimmed background also close it. View-only — no download button inside the overlay. Animated images (GIF and WebP) play only here; in the chat they appear as a still thumbnail.
- **Status and error screens (full, ended, not-found, removed, left, unsupported):** Centered, large readable text, with a single action button.
- **Remove-guest confirmation:** A small modal dialog centered over the call screen, with the prompt "Remove <name> from the call?" and two buttons — a red "Remove" (confirm) and a neutral "Cancel". The call UI stays visible behind the dialog; removal happens only on confirm. The dialog is blocking — while it is open the controls behind it are inert, and only one remove-confirmation dialog can be open at a time.
- **Tooltips:** Shown on hover/focus for camera, microphone, screen-share, end/leave, and the host's remove-guest controls, reflecting the current state.
- **Typography:** System font stack (no custom fonts) for a neutral appearance.
- **Animations:** Minimal — toggle state transitions, theme switch, chat panel open/close, screen-share layout change, the "Link copied!" fade, the image-viewer overlay open/close, and the unread-indicator appearance.

---

## 13. Risk Analysis

| # | Description | Category | Likelihood | Impact | Mitigation |
|---|-------------|----------|------------|--------|------------|
| R1 | **NAT/firewall traversal failure** — some participants behind restrictive networks may fail to establish a direct real-time connection, resulting in no video/audio. | Technical | Medium | High | Ensure a relay fallback is available in the technical implementation; surface a clear connection-failure message (NFR-12) rather than a blank screen. |
| R2 | **Group call quality with 4 participants plus a screen share** — simultaneous video and screen sharing may degrade on weak connections. | Technical | Medium | Medium | Continue at reduced quality rather than dropping (NFR-13); validate the four-participant-plus-share case early. |
| R3 | **Screen-share browser inconsistencies** — screen capture support and prompts vary across browsers. | Technical | Medium | Medium | Limit support to the latest 2 versions of the four named browsers; handle prompt cancellation and denial explicitly (FR-16); test on each early. |
| R4 | **Open-link access abuse** — anyone with the participant link can join an open slot. | Security | Medium | Medium | Accepted trade-off of the anonymous model; the host can remove a guest and end the call; the 4-cap and 128-bit link entropy limit exposure. Authentication is a possible future extension. |
| R5 | **Host link loss** — if the host loses the host URL (history cleared, different device), they cannot reclaim the host role and the room ends after the grace period. | Scope | Low | Medium | Accepted trade-off of the anonymous model; starting a new call requires only one click on the landing page. Documented for developers. |
| R6 | **Unscanned file attachments** — shared files are not scanned for malware; a participant could share a harmful file. | Security | Low | Medium | Type and size limits reduce exposure; recipients choose whether to download. Server-side scanning is a documented future option. |
| R7 | **Removed guest rejoins** — because removal does not block re-entry, a removed guest can rejoin via the link. | Scope | Low | Low | Explicit product decision; the host can remove again or end the call. A rejoin block is a documented future option. |
| R8 | **Grace-period race condition** — the host reconnecting near the 60-second boundary could race with room destruction. | Technical | Low | Low | Treat reconnection as an atomic operation that cancels the destruction timer (Assumption 9); specify in the technical document. |
| R9 | **Scope creep** — the polished spec may invite requests beyond the four-participant host/guest intent. | Scope | Medium | Medium | The Non-Goals list is explicit; evaluate any addition against the "four participants, one host, link-based" principle. |

---

## 14. Release Phases / MVP Scope

### MVP — Core Host/Guest Call + Text Chat

A complete, usable call: a host starts a call, copies the link, and talks with up to three guests in the adaptive grid with text chat; the host can end the call and guests can leave.

**Included requirements:**
- FR-1, FR-2, FR-3, FR-5 (room creation, 4-cap, host ends call, guest leaves)
- FR-7, FR-8, FR-9 (host/guest roles, copy link)
- FR-10, FR-11, FR-12 (pre-join, permissions, enter without devices)
- FR-13, FR-14, FR-15 (video grid, camera-off/mic-off indicators, audio)
- FR-17, FR-18, FR-19, FR-20, FR-21 (camera/mic toggles, end/leave, tooltips, controls layout)
- FR-22, FR-23, FR-24 (chat panel, history, text messages)
- FR-30 (landing page)
- US-1 through US-7, US-9, US-11, US-12, US-17
- Link-lifecycle screens (full, ended, not-found) and the core empty states (host alone, chat no-messages, permission-denied, guest-left).

*Note: FR-13's name labels are fully exercised in the adaptive grid for the MVP; the thumbnail-strip labels shown during screen sharing are verified together with FR-16 (screen sharing) in v1.0.*

**Exit criterion:** A host and three guests in different locations can start/join a call via link, see and hear one another in the correct layout, toggle camera and microphone, exchange text messages (including history visible to a later joiner), and end/leave the call — verified in Chrome on desktop.

### v1.0 — Screen Share, Attachments, Host Controls, Personalization, Cross-browser

Adds the remaining host controls, sharing, attachments, and personalization on top of the MVP.

**Included requirements (in addition to MVP):**
- FR-4 (host reconnect grace period)
- FR-6 (host removes a guest)
- FR-16 (screen sharing)
- FR-25 (unread chat indicator)
- FR-26, FR-27 (chat attachments)
- FR-28, FR-29 (theme and language switches)
- FR-31 (cross-browser support + unsupported-browser message)
- US-8, US-10, US-13, US-14, US-15, US-16
- NFR-1 through NFR-13 (all non-functional requirements verified)
- Full empty-state coverage per Section 7 (including host-disconnected overlay, removed-guest, and unsupported browser).

**Exit criterion:** The application passes a full test suite covering all functional requirements, validation rules, empty states, error messages, screen sharing, attachments, host removal and reconnection, and theme/language switching across the latest 2 versions of Chrome, Firefox, Safari, and Edge on desktop.

### Future / Backlog

Intentionally deferred; natural extension points, not part of this scope:

- **Persisting theme and language across browser sessions** (currently kept only within a session, across reloads).
- **Mobile-optimized layout.**
- **Blocking a removed guest from rejoining** the same room.
- **Server-side file scanning** (e.g., antivirus) for attachments.
- **Device selection** (choosing a specific camera/microphone).
- **Active-speaker highlighting.**
- **Authentication / private call access** for higher-security use.
- **Additional interface languages** (the externalized-strings setup is designed to make this low-effort).

---

## 15. Uncharted Territory

| Area | Assumption | Status |
|------|------------|--------|
| **Guest reconnection** | A dropped guest is treated as having left and rejoins manually; only the host has a grace period. | Assumed — verify in next session |
| **Multiple tabs / duplicate sessions** | If the same person opens the app in two tabs, each tab is an independent participant and counts toward the 4-cap; a host opening the host URL in a second tab takes over the host session. Not explored in depth. | Assumed — verify with development team |
| **Abuse / rate limiting** | No limit on call creation, join attempts, or message/attachment frequency is specified; rate limiting is treated as a server-side technical concern. | Assumed — verify in technical document |
| **Maximum call / idle duration** | No maximum call length or idle timeout is specified; the room stays alive while the host is present. | Assumed — verify in next session |
| **Attachment malware scanning** | Files are validated by type and size only and are not scanned for malware. | Assumed — verify in next session |
| **Accessibility beyond WCAG 2.1 AA basics** | Keyboard navigation, focus indicators, and aria-labels are specified; screen-reader testing, high-contrast mode, and reduced-motion preferences were not explored in depth. | Assumed — verify in next session |
| **Right-to-left languages** | Only English and Russian (both left-to-right) are in scope; RTL layout support is not specified. | Assumed — verify if more languages are added |
| **Failed-message retry behavior** | A message/attachment that fails to send is marked "Not delivered" and retained for manual resend; automatic retry was not specified. | Assumed — verify in next session |



Changelog — Camera-off представление (микрофон + имя вместо generic avatar)

In-call (PRD):

US-5, US-6 — камера off → иконка микрофона + имя по центру, без аватара.
US-7 — уточнения: иконка mute в углу (камера on) или по центру (камера off); при unmute с выключенной камерой центральная иконка переключается в состояние «вкл».
FR-14 — переписано: камера off → центр (иконка + имя, без аватара); камера on + mic off → угловая иконка mute.
FR-13 — имя при выключенной камере по центру под иконкой, а не в углу.
FR-16 + US-8 (миниатюры при шеринге), FR-17 (Success off) — синхронизированы.

Pre-join (PRD):

US-2, FR-11, Empty States — камера denied/off → центрированная иконка микрофона, без аватара и без имени.
FR-11 — заметка: отсутствие имени в превью — единственное отличие от in-call (FR-14).

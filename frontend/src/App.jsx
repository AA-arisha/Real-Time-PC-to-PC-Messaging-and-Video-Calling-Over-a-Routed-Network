import { useEffect, useState, useRef } from "react";
import { socket } from "./services/socket";

// STUN server helps the browser discover its public network address
const rtcConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function App() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState({});
  const [error, setError] = useState("");

  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [callError, setCallError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const activeCallUserRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);

  // Refs mirror state so socket handlers (registered once) never read stale values
  const usernameRef = useRef("");
  const callStatusRef = useRef("idle");
  const incomingCallRef = useRef(null);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  /* ------------------------------------------------------------------ */
  /* WebRTC helpers                                                      */
  /* ------------------------------------------------------------------ */

  async function getLocalStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access requires HTTPS or localhost. Your browser does not allow camera access from this address."
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  }

  function createPeerConnection(targetUserId) {
    const peer = new RTCPeerConnection(rtcConfiguration);

    peerConnectionRef.current = peer;

    // Send our ICE candidates to the other user
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: targetUserId,
          candidate: event.candidate
        });
      }
    };

    // Display the other user's incoming media
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          event.streams[0] || new MediaStream([event.track]);
      }
    };

    peer.onconnectionstatechange = () => {
      // Ignore events from an old connection that has been replaced
      if (peerConnectionRef.current !== peer) return;

      console.log("WebRTC connection:", peer.connectionState);

      if (peer.connectionState === "connected") {
        setCallStatus("connected");
        setCallError("");
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "disconnected"
      ) {
        setCallError(`WebRTC connection ${peer.connectionState}.`);
      }
    };

    return peer;
  }

  async function processPendingIceCandidates() {
    const peer = peerConnectionRef.current;

    if (!peer || !peer.remoteDescription) return;

    const candidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Could not add queued ICE candidate:", err);
      }
    }
  }

  function cleanupCall() {
    // Stop camera and microphone
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close the WebRTC connection
    if (peerConnectionRef.current) {
      const peer = peerConnectionRef.current;
      peerConnectionRef.current = null; // clear first so state events are ignored
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }

    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    pendingIceCandidatesRef.current = [];
    activeCallUserRef.current = null;

    incomingCallRef.current = null;
    callStatusRef.current = "idle";

    setIncomingCall(null);
    setCallStatus("idle");
  }

  /* ------------------------------------------------------------------ */
  /* Call actions (used by buttons)                                      */
  /* ------------------------------------------------------------------ */

  async function startCall() {
    if (!selectedUser || callStatusRef.current !== "idle") return;

    try {
      setCallError("");
      callStatusRef.current = "calling";
      setCallStatus("calling");
      activeCallUserRef.current = selectedUser;

      const stream = await getLocalStream();
      const peer = createPeerConnection(selectedUser);

      // Add our camera and microphone tracks to WebRTC
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      // Create an offer describing our connection
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Send the offer through Socket.IO
      socket.emit("call-user", {
        to: selectedUser,
        offer: peer.localDescription
      });
    } catch (err) {
      console.error("Error starting call:", err);
      cleanupCall();
      setCallError(err.message || "Could not start the call.");
    }
  }

  async function acceptCall() {
    const call = incomingCallRef.current;
    if (!call) return;

    try {
      setCallError("");

      const callerId = call.from;
      activeCallUserRef.current = callerId;

      const stream = await getLocalStream();
      const peer = createPeerConnection(callerId);

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      // Receive the caller's offer
      await peer.setRemoteDescription(new RTCSessionDescription(call.offer));

      // Add any ICE candidates received before the offer was set
      await processPendingIceCandidates();

      // Create our answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // Send the answer back to the caller
      socket.emit("answer-call", {
        to: callerId,
        answer: peer.localDescription
      });

      incomingCallRef.current = null;
      callStatusRef.current = "connecting";
      setIncomingCall(null);
      setCallStatus("connecting");
    } catch (err) {
      console.error("Error accepting call:", err);
      socket.emit("end-call", { to: call.from });
      cleanupCall();
      setCallError(err.message || "Could not accept the call.");
    }
  }

  function endCall() {
    const otherUser = activeCallUserRef.current;

    if (otherUser) {
      socket.emit("end-call", { to: otherUser });
    }

    cleanupCall();
  }

  function declineCall() {
    const call = incomingCallRef.current;

    if (call) {
      socket.emit("end-call", { to: call.from });
    }

    cleanupCall();
  }

  /* ------------------------------------------------------------------ */
  /* Socket listeners (registered once)                                  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    function handleConnect() {
      setConnected(true);
      setError("");
      socket.emit("register-user", { username: usernameRef.current });
    }

    function handleDisconnect() {
      setConnected(false);
      setUsers([]);
      cleanupCall();
    }

    function handleUsersUpdated(onlineUsers) {
      setUsers(onlineUsers);

      const otherUsers = onlineUsers.filter(
        (user) => user.socketId !== socket.id
      );

      if (otherUsers.length > 0) {
        setSelectedUser((current) =>
          otherUsers.some((user) => user.socketId === current)
            ? current
            : otherUsers[0].socketId
        );
      } else {
        setSelectedUser("");
      }
    }

    function handleReceiveMessage(newMessage) {
      const conversationId = newMessage.from;

      setConversations((previous) => ({
        ...previous,
        [conversationId]: [...(previous[conversationId] || []), newMessage]
      }));
    }

    function handleMessageSent(sentMessage) {
      const conversationId = sentMessage.to;

      setConversations((previous) => ({
        ...previous,
        [conversationId]: [...(previous[conversationId] || []), sentMessage]
      }));
    }

    function handleMessageError(data) {
      setError(data.message);
    }

    function handleIncomingCall(data) {
      // Already busy: reject the new caller
      if (callStatusRef.current !== "idle") {
        socket.emit("end-call", { to: data.from });
        return;
      }

      activeCallUserRef.current = data.from;
      incomingCallRef.current = data;
      callStatusRef.current = "ringing";

      setIncomingCall(data);
      setCallStatus("ringing");
    }

    async function handleCallAnswered(data) {
      const peer = peerConnectionRef.current;
      if (!peer) return;

      try {
        await peer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );

        await processPendingIceCandidates();

        callStatusRef.current = "connecting";
        setCallStatus("connecting");
      } catch (err) {
        console.error("Error processing call answer:", err);
        cleanupCall();
        setCallError("Could not establish the call.");
      }
    }

    async function handleIceCandidate(data) {
      const peer = peerConnectionRef.current;

      // Candidates may arrive before the remote description is set
      if (!peer || !peer.remoteDescription) {
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    }

    function handleCallEnded() {
      cleanupCall();
    }

    function handleCallError(data) {
      cleanupCall();
      setCallError(data.message);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("users-updated", handleUsersUpdated);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-sent", handleMessageSent);
    socket.on("message-error", handleMessageError);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-error", handleCallError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("users-updated", handleUsersUpdated);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-sent", handleMessageSent);
      socket.off("message-error", handleMessageError);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", handleCallAnswered);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-error", handleCallError);

      // Release camera/mic if the component unmounts mid-call
      cleanupCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------ */
  /* Chat actions                                                        */
  /* ------------------------------------------------------------------ */

  const joinNetwork = () => {
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    setError("");
    socket.connect();
  };

  function sendMessage() {
    if (!message.trim() || !selectedUser) return;

    socket.emit("send-message", {
      to: selectedUser,
      content: message
    });

    setMessage("");
  }

  const otherUsers = users.filter((user) => user.socketId !== socket.id);

  const callerName =
    users.find((user) => user.socketId === incomingCall?.from)?.username ||
    "Someone";

  const inCall = callStatus !== "idle" && callStatus !== "ringing";

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>PC Communication</h1>

      {!connected ? (
        <div>
          <input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") joinNetwork();
            }}
          />

          <button onClick={joinNetwork}>Connect</button>
        </div>
      ) : (
        <h3>Connected as {username}</h3>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Online Users</h2>

      {users.map((user) => (
        <div key={user.socketId}>{user.username} - Online</div>
      ))}

      {connected && (
        <>
          <div style={{ marginTop: "30px" }}>
            <h2>Chat</h2>

            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Select a user</option>

              {otherUsers.map((user) => (
                <option key={user.socketId} value={user.socketId}>
                  {user.username}
                </option>
              ))}
            </select>

            <div
              style={{
                border: "1px solid gray",
                padding: "15px",
                marginTop: "15px",
                minHeight: "200px"
              }}
            >
              {(conversations[selectedUser] || []).map((msg, index) => (
                <p key={`${msg.timestamp}-${index}`}>
                  <strong>{msg.senderName}:</strong> {msg.content}
                </p>
              ))}
            </div>

            <div style={{ marginTop: "15px" }}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Write a message..."
              />
              <button onClick={sendMessage} disabled={!selectedUser}>
                Send
              </button>
            </div>
          </div>

          <div style={{ marginTop: "30px" }}>
            <h2>Video Call</h2>

            <p>Status: {callStatus}</p>

            {callError && <p style={{ color: "red" }}>{callError}</p>}

            {callStatus === "ringing" && incomingCall && (
              <div style={{ marginBottom: "15px" }}>
                <strong>{callerName} is calling you.</strong>{" "}
                <button onClick={acceptCall}>Accept</button>{" "}
                <button onClick={declineCall}>Decline</button>
              </div>
            )}

            <div style={{ marginBottom: "15px" }}>
              <button
                onClick={startCall}
                disabled={!selectedUser || callStatus !== "idle"}
              >
                Start video call
              </button>{" "}
              <button onClick={endCall} disabled={!inCall}>
                End call
              </button>
            </div>

            {/* Always rendered so the refs exist when streams arrive */}
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
              <div>
                <p>You</p>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "320px", background: "#000" }}
                />
              </div>

              <div>
                <p>Remote</p>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: "320px", background: "#000" }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
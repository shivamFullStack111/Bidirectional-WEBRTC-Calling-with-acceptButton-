import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const socket = io("http://localhost:7000");

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/receiver" element={<Receive />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

const Home = () => {
  const peerAudioRef = useRef(null);
  const peerConnection = useRef(
    new RTCPeerConnection()
    //   {
    //   iceServers: [
    //     {
    //       urls: "stun:stun.l.google.com:19302", // Free STUN server from Google
    //     },
    //   ],
    // }
  );
  const [activeUsers, setActiveUsers] = useState([]);
  const [me, setMe] = useState("");

  useEffect(() => {
    if (!socket) return;

    socket.on("activeUsers", (users) => setActiveUsers(users));
    socket.on("me", (socketId) => setMe(socketId));
    socket.on("callAccepted", ({ answer }) => {
      peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });
    socket.on("candidate", async (candidate) => {
      await peerConnection.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    });

    return () => {
      socket.off("me");
      socket.off("activeUsers");
      socket.off("callAccepted");
      socket.off("candidate");
    };
  }, []);

  const handleCall = async (userId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream
        .getTracks()
        .forEach((track) => peerConnection.current.addTrack(track, stream));

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("candidate", { candidate: event.candidate, to: userId });
        }
      };

      peerConnection.current.ontrack = (event) => {
        peerAudioRef.current.srcObject = event.streams[0];
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("call", { offer, to: userId });
    } catch (error) {
      console.error("Error starting call:", error);
    }
  };

  return (
    <div>
      <audio ref={peerAudioRef} autoPlay controls />
      {activeUsers?.map((socketId) =>
        socketId !== me ? (
          <div key={socketId} onClick={() => handleCall(socketId)}>
            Call {socketId}
          </div>
        ) : null
      )}
    </div>
  );
};

const Receive = () => {
  const peerAudioRef = useRef(null);
  const peerConnection = useRef(
    new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302", // Free STUN server from Google
        },
      ],
    })
  );
  const [isCallIncoming, setIsCallIncoming] = useState(false);
  const [offer, setOffer] = useState(null);
  const [from, setFrom] = useState(null);

  useEffect(() => {
    if (!socket) return;

    peerConnection.current.ontrack = (event) => {
      peerAudioRef.current.srcObject = event.streams[0];
    };

    socket.on("incomingCall", async ({ offer, from }) => {
      setIsCallIncoming(true);
      setOffer(offer);
      setFrom(from);
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
    });

    socket.on("candidate", async (candidate) => {
      await peerConnection.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    });

    return () => {
      socket.off("incomingCall");
      socket.off("candidate");
    };
  }, []);

  const handleAccept = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream
        .getTracks()
        .forEach((track) => peerConnection.current.addTrack(track, stream));

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("candidate", { candidate: event.candidate, to: from });
        }
      };

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { answer, to: from });
      setIsCallIncoming(false);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  };

  return (
    <div>
      <audio ref={peerAudioRef} autoPlay controls />
      {isCallIncoming && <button onClick={handleAccept}>Accept Call</button>}
    </div>
  );
};

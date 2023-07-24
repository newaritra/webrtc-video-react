import React, { useEffect, useRef } from "react";
import "./Video.css";
import { useState } from "react";
import { socket } from "../socket";
const VideoPlayer = () => {
  const [displayOn, setDisplayOn] = useState(false);
  // const [socketId, setSocketId] = useState(null);
  const videoRef = useRef(null);
  const displayRef = useRef(null);

  const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  const socketInit = () => {
    socket.on("connect", () => {
      console.log("Socket connection to server is initialized");
      // setSocketId(socket.id);
      createOffer();
      console.log(socket.id);
    });
    socket.on("disconnect", () =>
      console.log("Socket connection to server is disconnected")
    );
    socket.on("chat", (message) => {
      console.log(message);
    });
  };
  const socketDeinit = () => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("chat");
  };

  const getNavigatorDevices = async (constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints);
  };

  const displayMedia = async () => {
    if (!displayOn) {
      setDisplayOn((prev) => !prev);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always" | "motion" | "never",
          displaySurface: "application" | "browser" | "monitor" | "window",
        },
        audio: true,
      });
      displayRef.current.srcObject = displayStream;
      displayRef.current.play();
      displayRef.current.srcObject
        .getVideoTracks()[0]
        .addEventListener("ended", () => {
          setDisplayOn(false);
          console.log("The user has ended sharing the screen");
        });
    } else {
      displayRef.current = null;
      setDisplayOn((prev) => !prev);
    }
  };

  const createOffer = async () => {
    const { id: socketId } = socket;
    console.log("The socket ID is", socketId, socket.id);
    let peerConnection = new RTCPeerConnection(servers);

    let remoteStream = new MediaStream();
    console.log("Checking for error", videoRef.current);
    videoRef.current.srcObject.getTracks().forEach((track) => {
      peerConnection.addTrack(track, videoRef.current.srcObject);
    });
    const div = document.createElement("div");
    const video = document.createElement("video");
    video.playsInline = true;
    video.autoplay = true;
    div.append(video);
    document.getElementsByClassName("videoContainer")[0].append(div);

    peerConnection.ontrack = (event) => {
      [remoteStream] = event.streams;
      console.log("We are getting remote tracks", remoteStream);
      // video.width=400;
      video.srcObject = remoteStream;
      // displayRef.current.srcObject = remoteStream;
    };

    peerConnection.onconnectionstatechange = (e) => {
      if (peerConnection.connectionState === "connected") {
        console.log("We are connected over WebRTC");
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("chat", { socketId, iceCandidate: event.candidate });
        console.log("ICE candidate", event.candidate);
      }
    };

    //set up socket listener to listen for messages with the remote icecandidates
    socket.on("chat", async (message) => {
      console.log("We are getting messages boi", message);
      if (message.socketId !== socketId && message.iceCandidate) {
        try {
          console.log("We are getting ice candidates");
          peerConnection.addIceCandidate(message.iceCandidate);
        } catch (err) {
          console.log("Error on recieving ice candidate", err);
        }
      }

      //socket listening for an answer
      else if (message.socketId !== socketId && message.answer) {
        try {
          console.log("We are getting answer");
          const remoteDesc = new RTCSessionDescription(message.answer);
          await peerConnection.setRemoteDescription(remoteDesc);
        } catch (err) {
          console.log(new Error(err));
        }
      } else if (message.socketId !== socketId && message.offer) {
        console.log("We are getting offer");
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.offer)
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("chat", { socketId, answer });
      }
    });
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    //socket for sending an offer
    socket.emit("chat", { socketId, offer });
    console.log("Offer", offer);
  };

  useEffect(() => {
    (async () => {
      const stream = await getNavigatorDevices({
        video: true,
        audio: true,
      });
      videoRef.current.srcObject = stream;
      console.log("checking", videoRef.current.srcObject);
      videoRef.current.muted = true;
      // createOffer();
    })();
    socketInit();
    return () => {
      socketDeinit();
    };
  }, []);

  return (
    <>
      <div className="videoContainer">
        {/* {displayOn && ( */}
        {/* <div>
          <video className="videoTwo" ref={displayRef} autoPlay playsInline />
        </div> */}
        {/* )} */}
        <div>
          <video className="videoOne" ref={videoRef} autoPlay playsInline />
        </div>
      </div>
      <button onClick={displayMedia}>
        {displayOn ? "Unp" : "P"}resent your screen
      </button>
      <button
        onClick={() => (videoRef.current.muted = !videoRef.current.muted)}
      >
        Mute
      </button>
      <button
        onClick={() =>
          (videoRef.current.srcObject.getVideoTracks()[0].enabled =
            !videoRef.current.srcObject.getVideoTracks()[0].enabled)
        }
      >
        Video
      </button>
    </>
  );
};

export default VideoPlayer;

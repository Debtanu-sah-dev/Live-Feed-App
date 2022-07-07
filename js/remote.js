// Stream server For Peer To Peer Connection

const servers = {
    iceServers: [{
        urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302"
        ]
    }],
    iceCandidatePoolSize: 10
}

//Global Stream

let PeerConnection = new RTCPeerConnection(servers);
let remoteStream = new MediaStream();


//DOM Elements

const video = document.querySelector('#video');
const link = document.querySelector('[data-link]');
const connecter = document.querySelector('[data-connecter]');

video.srcObject = remoteStream;

PeerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
    });
}

async function connect() {
    try {
        const feedId = link.value;
        const feedDoc = db.collection("feeds").doc(feedId);
        const offer = feedDoc.collection("offer");
        const answer = feedDoc.collection("candidate");

        
        PeerConnection.onicecandidate = event => {
            event.candidate && answer.add(event.candidate.toJSON())
        }

        let callData = await feedDoc.get();

        const offerer = new RTCSessionDescription(callData.data().offer);
        await PeerConnection.setRemoteDescription(offerer);

        let answerer = await PeerConnection.createAnswer();
        await PeerConnection.setLocalDescription(answerer);
        feedDoc.update({
            answer:{
                sdp: answerer.sdp,
                type: answerer.type
            }
        })

        offer.onSnapshot(async function (snapshot) {
            snapshot.docChanges().forEach(async function (change) {
                if (change.type === "added") {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    await PeerConnection.addIceCandidate(candidate);
                }
            })
        })



        video.play();
        // if(feedDoc){
        //     throw new Error();
        // }
        // connecter.style.display = "none";
        // let remDesc = new RTCSessionDescription(await feedDoc.get().data().sdp);
        // await PeerConnection.setRemoteDescription(remDesc);
        // let answer = await PeerConnection.createAnswer();
        // await PeerConnection.setLocalDescription(answer);
    } catch (e) {
        console.error(e);
        alert("Invalid Link");
    }
}

connecter.addEventListener("click", connect);

//Initialize link
if (new URLSearchParams(location.search).get("c") != null) {
    link.value = new URLSearchParams(location.search).get("c");
    connect();
}
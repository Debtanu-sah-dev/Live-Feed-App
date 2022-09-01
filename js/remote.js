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
const videoc = document.querySelector('#video-container');
const link = document.querySelector('[data-link]');
const fullBtn = document.querySelector('[data-fullscreen]');
const connecter = document.querySelector('[data-connecter]');
const connecter_wrap = document.querySelector('#connecter');
const announce_input = document.querySelector('[data-aninp]');
const announce_btn = document.querySelector('[data-anbtn]');
const announce_panel = document.querySelector('#announce-panel');
const motion_info = document.querySelector("#motion_obj");
let isFullscreenCon = false;
let dataChannel;
let motionChannel;
let motion_obj = null;

PeerConnection.addEventListener("datachannel", (e) => {
    if(e.channel.label == "message"){
        dataChannel = e.channel;
    }
    if(e.channel.label == "motion"){
        motionChannel = e.channel;

        motionChannel.addEventListener("message", (e) => {
            motion_obj = JSON.parse(e.data);
        })
    }
})

announce_btn.addEventListener("click", () => {
    if(announce_input.value.trim() != ""){
        dataChannel.send(announce_input.value)
    }
})

fullBtn.addEventListener("click", () => {
    isFullscreenCon = !isFullscreenCon;
    if(isFullscreenCon){
        videoc.requestFullscreen();
        fullBtn.innerText = "Exit Fullscreen"
    }
    else{
        document.exitFullscreen();
        fullBtn.innerText = "Fullscreen"
    }
})

PeerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
    });
}

async function connect(feedId = link.value) {
    try {
        const feedDoc = db.collection("feeds").doc(feedId);
        const offer = feedDoc.collection("offer");
        const answer = feedDoc.collection("candidate");
        const newp = feedDoc.collection("newp");
        let callData = await feedDoc.get();
        if(callData.data().full == false){

            video.srcObject = remoteStream;
    
            PeerConnection.onicecandidate = event => {
                event.candidate && answer.add(event.candidate.toJSON())
            }
    
    
            const offerer = new RTCSessionDescription(callData.data().offer);
            await PeerConnection.setRemoteDescription(offerer);
    
            let answerer = await PeerConnection.createAnswer();
            await PeerConnection.setLocalDescription(answerer);
            feedDoc.update({
                answer:{
                    sdp: answerer.sdp,
                    type: answerer.type
                },
                full:true
            })
    
            offer.onSnapshot(async function (snapshot) {
                snapshot.docChanges().forEach(async function (change) {
                    if (change.type === "added") {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        await PeerConnection.addIceCandidate(candidate);
                    }
                })
            })
    
            // if(feedDoc){
            //     throw new Error();
            // }
            // connecter.style.display = "none";
            // let remDesc = new RTCSessionDescription(await feedDoc.get().data().sdp);
            // await PeerConnection.setRemoteDescription(remDesc);
            // let answer = await PeerConnection.createAnswer();
            // await PeerConnection.setLocalDescription(answer);
        }
        else{
            let doc = newp.doc();

            doc.set({})
            
            doc.onSnapshot((snapshot) => {
                const data = snapshot.data();
                if(!PeerConnection.currentRemoteDescription && data.id != null){
                    connect(data.id);
                }
            })
        }

        announce_panel.style.display = "block";

        return true;
    } catch (e) {
        console.error(e);
        alert("Invalid Link");
        return false;
    }
}

connecter.addEventListener("click", async () => {
    let bool = await connect();
    if(bool){
        connecter_wrap.style.display = "none";
    }
});

PeerConnection.addEventListener("connectionstatechange",(e) => {
    console.log(e)
    console.log(PeerConnection.connectionState)
    if(PeerConnection.connectionState == "disconnected"){
        endsession();
    }
})

function endsession(){
    console.log("Session Ended 🔚")
}

//Initialize link
if (new URLSearchParams(location.search).get("c") != null) {
    link.value = new URLSearchParams(location.search).get("c");
    connect();
}
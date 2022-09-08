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
const geolocation_con = document.querySelector("#Geolocation");
const elevation = document.querySelector("#elevation");
const vrbtn = document.querySelector("[data-vr]");
const bufvideo = document.querySelector("#bufvideo");
let isVr = false;
let isFullscreenCon = false;
let dataChannel;
let motionChannel;
let glChannel;
let motion_obj = null;
let gl_buffer = null;
let map_markers = []
let map = L.map('Geolocation').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

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
    if(e.channel.label == "gl"){
        glChannel = e.channel;

        glChannel.addEventListener("message",async function (e)  {
            let data = JSON.parse(e.data)
            map.setView([data.lat,data.lon],13);
            let marker = L.marker([data.lat,data.lon]).addTo(map);
            map_markers.push(marker)
            let elevation_buffer = await fetchElevation(data.lat,data.lon);
            let p = 2;
            elevation.innerText = `Elevation: ${Math.round((elevation_buffer.results[0].elevation * 3.28084)*(10**p))/(10**p)} ft`
        })
    }
})

async function fetchElevation(lat, lon) {
    let response = await fetch("https://api.open-elevation.com/api/v1/lookup?locations=" + lat + "," + lon)
    let elevation_buffer = await response.json();
    return elevation_buffer;
}

announce_btn.addEventListener("click", () => {
    if(announce_input.value.trim() != ""){
        dataChannel.send(announce_input.value)
    }
})

vrbtn.addEventListener("click", () => {
    isVr = !isVr;
    if(isVr){
        bufvideo.srcObject = remoteStream;
        video.classList.add("full");
        bufvideo.classList.add("full");
        bufvideo.style.display = "flex"
        videoc.requestFullscreen()
        fullBtn.style.display = "none"
    }
    else{
        video.classList.remove("full");
        bufvideo.classList.remove("full");
        bufvideo.srcObject = null;
        document.exitFullscreen();
        fullBtn.style.display = "initial"
    }
})

document.addEventListener('fullscreenchange', onFullScreenChange, false);
document.addEventListener('webkitfullscreenchange', onFullScreenChange, false);
document.addEventListener('mozfullscreenchange', onFullScreenChange, false);

function onFullScreenChange() {
    var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;

    if(fullscreenElement == null){
        vrbtn.style.display = "initial"
        fullBtn.style.display = "initial"
        fullBtn.innerText = "Full screen"
        video.classList.remove("full");
        bufvideo.style.display = "none"
        bufvideo.classList.remove("full");
        bufvideo.srcObject = null;
        isVr=false;
        isFullscreenCon = false;
    }
}

fullBtn.addEventListener("click", () => {
    isFullscreenCon = !isFullscreenCon;
    if(isFullscreenCon){
        videoc.requestFullscreen();
        fullBtn.innerText = "Exit Fullscreen"
        vrbtn.style.display = "none"
    }
    else{
        document.exitFullscreen();
        fullBtn.innerText = "Full screen"
        vrbtn.style.display = "initial"
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
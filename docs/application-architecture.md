```mermaid
    flowchart TB
    subgraph CLIENT_A["Client A - Browser"]
        A["React + Vite Frontend"]
        A1["Username Registration"]
        A2["Private Chat Interface"]
        A3["Video / Audio Call Interface"]
        A --> A1
        A --> A2
        A --> A3
    end

    subgraph SERVER["Node.js Backend"]
        B["Express Server"]
        C["Socket.IO Server"]
        D["Online Users Map"]
        E["WebRTC Signaling"]
        B --> C
        C --> D
        C --> E
    end

    subgraph CLIENT_B["Client B - Browser"]
        F["React + Vite Frontend"]
        F1["Private Chat Interface"]
        F2["Video / Audio Call Interface"]
        F --> F1
        F --> F2
    end

    A <-->|"HTTPS / Socket.IO"| C
    F <-->|"HTTPS / Socket.IO"| C

    A2 <-->|"Chat messages"| C
    C <-->|"Deliver messages"| F1

    A3 <-->|"Offer / Answer / ICE"| E
    E <-->|"Offer / Answer / ICE"| F2

    A3 <-->|"WebRTC Peer-to-Peer Media"| F2

    G["STUN Server"]
    A3 <-->|"ICE candidate discovery"| G
    F2 <-->|"ICE candidate discovery"| G

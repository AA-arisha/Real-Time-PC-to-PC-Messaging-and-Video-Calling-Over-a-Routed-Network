import express from "express";
import http from "http";
import cors from "cors";
import {Server} from "socket.io";

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET" , "POST"]
    }
})

const users = new Map();

io.on("connection" , (socket) => {
    console.log("Client connected:" , socket.id);

    socket.on("register-user" , ({username}) => {
        users.set(socket.id, {
            username,
            socketId: socket.id
        });

        console.log(`${username} joined`);

        io.emit("users-updated" , Array.from(users.values()));
    });

    socket.on("disconnect" , () =>{
        users.delete(socket.id);

        console.log("Client disconnected: " , socket.id);

        io.emit("users-updated" , Array.from(users.values()));
    });

    socket.on("send-message" , ({to , content}) => {
        // validate users
        if(!users.has(to)){
            socket.emit("message-error" , {
                message: "Recipient is not online."
            });

            return;
        }
        // validate the message

        if (typeof content !== "string" || !content.trim()){
            socket.emit("message-error" , {
                message: "Message cannot be empty."
            });

            return;
        }

        const sender = users.get(socket.id);
        const message = {
            from: socket.id,
            to: to,
            senderName: sender.username,
            content: content.trim(),
            timestamp: Date.now()
        };

        io.to(to).emit("receive-message" , message);
        socket.emit("message-sent" , message);

    });

    socket.on("call-user" , ({to ,offer}) =>{
        const caller = users.get(socket.id);

        if(!caller){
            socket.emit("call-error" , {
                message: "Please register before calling"
            });
            return;
        }

        if(!users.has(to)){
            socket.emit("call-error" , {
                message: "The user is not online."
            });
            return;
        }

        io.to(to).emit("incoming-call" , {
            from: socket.id,
            callerName: caller.username,
            offer
        });
    });

    socket.on("answer-call" , ({to , answer}) => {
        if(!users.has(to)){
            socket.emit("call-error", {
                message: "The caller is no longer online."
            });
            return;
        }

        io.to(to).emit("call-answered" , {
            from: socket.id,
            answer
        });
    });

    socket.on("ice-candidate" , ({to , candidate}) => {
        if(!users.has(to)){
            return;
        }

        io.to(to).emit("ice-candidate" , {
            from: socket.id,
            candidate
        });
    });

    socket.on("end-call" , ({ to }) => {
        if(!users.has(to)){
            return;
        }

        io.to(to).emit("call-ended" , {
            from: socket.id
        });
    });


});

app.get("/" , (req,res) => {
    res.send("PC communication server running");
});

const PORT = 5000;

httpServer.listen(PORT, "0.0.0.0" , () => {
    console.log(`Server running on port ${PORT}`);
});
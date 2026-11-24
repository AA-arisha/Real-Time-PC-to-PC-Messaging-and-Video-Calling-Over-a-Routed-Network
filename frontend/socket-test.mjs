import { io } from "socket.io-client";

const URL = "http://10.0.1.10:5000";

const clientA = io(URL, { transports: ["websocket"] });
const clientB = io(URL, { transports: ["websocket"] });

function connect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connection timeout")), 10000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForEvent(socket, event, condition) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 10000);

    socket.on(event, function handler(data) {
      if (condition(data)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(data);
      }
    });
  });
}

try {
  await Promise.all([connect(clientA), connect(clientB)]);

  console.log("Both clients connected.");

  const usersReady = waitForEvent(
    clientB,
    "users-updated",
    users => users.length === 2
  );

  clientA.emit("register-user", { username: "Client A" });
  clientB.emit("register-user", { username: "Client B" });

  const users = await usersReady;
  console.log("Registered users:", users.map(u => u.username));

  const recipient = users.find(u => u.username === "Client B");

  const messageReceived = waitForEvent(
    clientB,
    "receive-message",
    msg => msg.content === "Hello through the routed network!"
  );

  clientA.emit("send-message", {
    to: recipient.socketId,
    content: "Hello through the routed network!"
  });

  const message = await messageReceived;

  console.log("MESSAGE DELIVERED SUCCESSFULLY:");
  console.log(message);

} catch (error) {
  console.error("TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  clientA.disconnect();
  clientB.disconnect();
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3006",
  },
});

app.use(cors());
app.use(express.json());


mongoose.connect("mongodb://localhost:27017/adminChat", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to the adminChat database!");
}).catch((err) => {
  console.error("Error connecting to the adminChat database:", err);
});

const adminDb = mongoose.createConnection("mongodb://localhost:27017/Financial_analysis", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

adminDb.once('open', () => {
  console.log("Connected to the adminInfo database!");
});

adminDb.on('error', (err) => {
  console.error("Error connecting to the adminInfo database:", err);
});

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

const Message = mongoose.model('Message', messageSchema);

const chatSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  profilePic: { type: String },
  name: { type: String },
  read: { type: Boolean, default: false },
});

const Chat = mongoose.model('Chat', chatSchema);


let onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("joinRoom", (adminId) => {
    onlineUsers.set(adminId, socket.id);
    console.log(`${adminId} joined the room`);
  });

  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    if (!senderId || !receiverId || !message) {
      return console.log("Sender, Receiver, and Message are required");
    }

    try {
      const newMessage = new Message({
        senderId,
        receiverId,
        message,
      });

      await newMessage.save();
      console.log("Message saved successfully");

      if (onlineUsers.has(receiverId)) {
        io.to(onlineUsers.get(receiverId)).emit("receiveMessage", { senderId, message });
      }
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.forEach((value, key) => {
      if (value === socket.id) onlineUsers.delete(key);
    });
  });
});

// Routes
app.get('/messages/:senderId/:receiverId', async (req, res) => {
  const { senderId, receiverId } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    }).sort({ timestamp: 1 });

    if (messages.length === 0) {
      return res.status(404).json({ message: "No messages found" });
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Error fetching messages" });
  }
});


app.get('/chats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const chats = await Message.aggregate([
      { 
        $match: { 
          $or: [{ senderId: userId }, { receiverId: userId }] 
        }
      },
      { 
        $group: {
          _id: { senderId: '$senderId', receiverId: '$receiverId' },
          lastMessage: { $last: '$message' },
          lastMessageTime: { $last: '$timestamp' },
          profilePic: { $last: '$profilePic' },
          unreadCount: { 
            $sum: { 
              $cond: [{ $eq: ['$read', false] }, 1, 0] 
            } 
          }
        }
      },
      // Lookup sender's information from the admins collection
      {
        $lookup: {
          from: 'admins', // Referencing the admins collection in Financial_analysis database
          localField: '_id.senderId',
          foreignField: '_id',
          as: 'senderInfo'
        }
      },
      // Lookup receiver's information from the admins collection
      {
        $lookup: {
          from: 'admins', // Referencing the admins collection for the receiver
          localField: '_id.receiverId',
          foreignField: '_id',
          as: 'receiverInfo'
        }
      },
      {
        $project: {
          senderId: '$_id.senderId',
          receiverId: '$_id.receiverId',
          lastMessage: 1,
          lastMessageTime: 1,
          profilePic: 1,
          unreadCount: 1,
          senderName: { $arrayElemAt: ['$senderInfo.name', 0] },
          receiverName: { $arrayElemAt: ['$receiverInfo.name', 0] }
        }
      }
    ]);

    if (!chats.length) {
      return res.status(404).json({ message: "No chats found" });
    }

    const updatedChats = chats.map(chat => {
      const name = chat.senderId === userId ? chat.receiverName : chat.senderName;
      return { ...chat, name };
    });

    res.json(updatedChats);
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ message: "Error fetching chats" });
  }
});

const adminSchema = new mongoose.Schema({
    name: String,
    surname: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
  });
  
  const Admin = adminDb.model('Admin', adminSchema);
  app.get('/admin/name/:receiverId', async (req, res) => {
    try {
        const receiverId = req.params.receiverId;
        const admin = await Admin.findById(receiverId);  
        if (admin) {
            res.json({ name: admin.name });
        } else {
            res.status(404).json({ error: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error fetching admin name' });
    }
});
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

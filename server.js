const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

// Environment variables
const API_TOKEN = process.env.TODOIST_TOKEN;
const EXPECTED_PASSWORD = process.env.APP_PASSWORD;

if (!API_TOKEN || !EXPECTED_PASSWORD) {
  console.error(
    "ERROR: Please set TODOIST_TOKEN and APP_PASSWORD in your .env file",
  );
  process.exit(1);
}

// Serve the HTML form at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API endpoint for Todoist integration
app.post("/api/todoist", async (req, res) => {
  try {
    const { password, message } = req.body;

    // Validate input
    if (!password || !message) {
      return res.status(400).json({
        success: false,
        error: "Password and message are required",
      });
    }

    // Check password
    if (password !== EXPECTED_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: "Invalid password",
      });
    }

    // Sanitize message (basic XSS protection)
    const sanitizedMessage = message.replace(/[<>]/g, "").trim();

    if (sanitizedMessage.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message cannot be empty",
      });
    }

    // Send to Todoist API
    const todoistResponse = await axios.post(
      "https://api.todoist.com/rest/v2/tasks",
      {
        content: sanitizedMessage,
        project_id: null, // Will go to inbox
      },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`Task created successfully: ${sanitizedMessage}`);
    res.json({
      success: true,
      message: "Task added to Todoist successfully!",
      taskId: todoistResponse.data.id,
    });
  } catch (error) {
    console.error(
      "Error sending to Todoist:",
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      res.status(500).json({
        success: false,
        error: "Invalid Todoist API token",
      });
    } else if (error.response?.status === 403) {
      res.status(500).json({
        success: false,
        error: "Todoist API access forbidden",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to add task to Todoist",
      });
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    "Make sure to set TODOIST_TOKEN and APP_PASSWORD in your .env file",
  );
});

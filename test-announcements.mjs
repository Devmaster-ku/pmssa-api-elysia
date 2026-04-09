import http from "http";

// Test the announcements endpoint
const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/maintenance/announcements",
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Status Code:", res.statusCode);
    console.log("Response:", data);
    process.exit(0);
  });
});

req.on("error", (error) => {
  console.error("Request error:", error.message);
  process.exit(1);
});

req.end();

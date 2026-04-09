import http from "http";

// Test the budget-groups endpoint
const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/settings/budget-groups",
  method: "GET",
  headers: {
    "Authorization": "Bearer dummy-token",
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
    
    if (res.statusCode === 500) {
      console.error("❌ Still getting 500 error!");
      process.exit(1);
    } else {
      console.log("✅ API is responding (no 500 error)");
      process.exit(0);
    }
  });
});

req.on("error", (error) => {
  console.error("Request error:", error.message);
  process.exit(1);
});

req.end();

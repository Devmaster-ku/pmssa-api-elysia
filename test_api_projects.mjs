fetch("http://localhost:3000/api/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer 8" }, // Mocking some token or auth middleware
  body: JSON.stringify({
    parentId: 1,
    projectName: "Test",
    initialBudget: "1000",
    orgId: 1,
    budgetTypeId: null,
    budgetGroupId: null,
    year: "2568",
    projectType: "sub",
    targets: [{name:"Test target", value:"1", unit:"ครั้ง"}]
  })
}).then(r => r.json()).then(console.log).catch(console.error);

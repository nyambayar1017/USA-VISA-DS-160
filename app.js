const form = document.querySelector("#visa-form");
const statusNode = document.querySelector("#form-status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusNode.textContent = "Sending...";

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not submit the form");
    }

    form.reset();
    statusNode.textContent = "Thank you. Your answers were submitted.";
  } catch (error) {
    statusNode.textContent = error.message;
  }
});

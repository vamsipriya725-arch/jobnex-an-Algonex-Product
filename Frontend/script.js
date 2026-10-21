// Script.js

const form = document.getElementById("analyze-form");
const resumeInput = document.getElementById("resume_text");
const jobDescriptionInput = document.getElementById("jd_text");
const button = document.getElementById("analyze-button");
const status = document.getElementById("status");
const results = document.getElementById("results");
const resultData = document.getElementById("result-data");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    button.disabled = true;
    status.textContent = "Analyzing resume...";
    results.hidden = true;

    try {
        const response = await fetch(
            "http://127.0.0.1:8000/api/analyze",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    resume_text: resumeInput.value,
                    jd_text: jobDescriptionInput.value
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Request failed");
        }

        resultData.textContent = JSON.stringify(data, null, 2);
        results.hidden = false;
        status.textContent = "Analysis completed successfully!";

    } catch (error) {
        status.textContent =
            "Could not analyze resume: " + error.message;

    } finally {
        button.disabled = false;
    }
});
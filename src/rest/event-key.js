export async function getEventKey(matchId) {
  try {
    const response = await fetch(
      `https://api.webook.com/api/v2/event-detail/${matchId}?lang=en&visible_in=rs`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          token:
            "e9aac1f2f0b6c07d6be070ed14829de684264278359148d6a582ca65a50934d2",
          // Add any necessary headers, such as authentication tokens
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching event key:", error);
  }
}

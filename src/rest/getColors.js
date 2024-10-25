export async function getColors(eventKey) {
  try {
    const response = await fetch(
      `https://cdn-eu.seatsio.net/system/public/3d443a0c-83b8-4a11-8c57-3db9d116ef76/rendering-info?event_key=${eventKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",

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

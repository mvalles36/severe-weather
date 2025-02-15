exports.handler = async (event) => {
    try {
        const data = JSON.parse(event.body);
        console.log("Received Data:", data);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Webhook received successfully!" }),
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid request" }),
        };
    }
};

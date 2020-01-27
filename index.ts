import amqp from "amqplib";

let connection: amqp.Connection;
let channel: amqp.Channel;

export default {
  publish: async (exchange: string, routingKey: string, payload: any) => {
    try {
      channel.assertExchange(exchange, "topic", { durable: false });
      channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload))
      );
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  },
  listen: async (
    exchange: string,
    routingKey: string,
    onMessage: (message: any) => void,
    onClose: () => void
  ) => {
    channel.assertExchange(exchange, "topic", { durable: false });
    const queue = await channel.assertQueue("", { exclusive: true });
    channel.bindQueue(queue.queue, exchange, routingKey);
    channel.consume(queue.queue, message => {
      if (message) {
        const data = JSON.parse(message.content.toString());
        onMessage(data);
      } else if (onClose) onClose();
    });
    return queue.queue;
  },
  cancelListen: async (queue: string) => {
    channel.deleteQueue(queue);
  },
  configureRabbitMQ: async (
    host: string,
    port: string,
    user: string,
    password: string
  ) => {
    const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
    console.log(`Connecting to RabbitMQ @ ${rabbitUrl}`);
    connection = await amqp.connect(rabbitUrl);
    console.log("Connection to RabbitMQ established successfully");
    channel = await connection.createChannel();
    console.log("RabbitMQ channel opened");
  },
  disconnectRabbitMQ: async () => {
    try {
      await connection.close();
      console.log("RabbitMQ connection closed successfully");
    } catch (e) {
      console.log("Error closing RabbitMQ connection and/or channel", e);
    }
  }
};

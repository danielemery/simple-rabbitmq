import amqp, { Connection, Channel } from 'amqplib';

export interface IRabbitOptions {
  host: string;
  port: string;
  user: string;
  password: string;
}

export default class Rabbit<T> {
  connection?: Connection;
  channel?: Channel;
  options: IRabbitOptions;

  constructor(options: IRabbitOptions) {
    this.options = options;
  }

  public async connect() {
    const { user, password, host, port } = this.options;
    const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
    console.log(`Connecting to RabbitMQ @ ${rabbitUrl}`);
    this.connection = await amqp.connect(rabbitUrl);
    console.log('Connection to RabbitMQ established successfully');
    this.channel = await this.connection.createChannel();
    console.log('RabbitMQ channel opened');
  }

  public async disconnect() {
    try {
      if (this.connection) {
        await this.connection.close();
        console.log('RabbitMQ connection closed successfully');
      } else {
        console.log('No open RabbitMQ connection to close');
      }
    } catch (e) {
      console.log('Error closing RabbitMQ connection and/or channel', e);
    }
  }

  public async publish(
    exchange: string,
    routingKey: string = '',
    payload: T,
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    try {
      await this.channel.assertExchange(exchange, 'topic', { durable: false });
      const result = await this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
      );
      return result;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  public async listen(
    exchange: string,
    routingKey: string = '',
    onMessage: (message: T) => void,
    onClose: () => void,
  ) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: false });
    const queue = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue.queue, exchange, routingKey);
    this.channel.consume(queue.queue, message => {
      if (message) {
        const data = JSON.parse(message.content.toString());
        onMessage(data);
      } else if (onClose) onClose();
    });
    return queue.queue;
  }
}

import amqp, { ConfirmChannel, Connection } from 'amqplib';
import ILogger from '../logger';
import { wait } from '../wait';

export interface IRabbitConnectionDetails {
  host: string;
  port: string;
  user: string;
  password: string;
}

export interface IRetryOptions {
  retry?: boolean;
  retryWait?: number;
  timeoutMillis?: number;
}

export default class RabbitConnectionManager {
  private connectionState:
    | 'disconnected'
    | 'reconnecting'
    | 'connected'
    | 'disconnecting';
  private queuedListeners: (() => void)[];
  private connectionDetails: IRabbitConnectionDetails;
  private logger: ILogger;
  private retryOptions: IRetryOptions | undefined;

  private connection?: Connection;
  private channel?: ConfirmChannel;

  constructor(
    connectionDetails: IRabbitConnectionDetails,
    logger: ILogger,
    retryOptions?: IRetryOptions,
  ) {
    this.connectionDetails = connectionDetails;
    this.retryOptions = retryOptions;
    this.connectionState = 'disconnected';
    this.queuedListeners = [];
    this.logger = logger;

    this.handleConnected = this.handleConnected.bind(this);
    this.handleConnectionClosed = this.handleConnectionClosed.bind(this);
    this.handleChannelClosed = this.handleChannelClosed.bind(this);
    // this.handleConnectionError = this.handleConnectionError.bind(this);
  }

  public async connect() {
    return this.reconnect();
  }

  public async disconnect() {
    this.connectionState = 'disconnecting';
    try {
      if (this.connection) {
        await this.connection.close();
        this.connection = undefined;
        this.logger.info('RabbitMQ connection closed successfully');
      } else {
        this.logger.info('No open RabbitMQ connection to close');
      }
    } catch (e) {
      this.logger.error('Error closing RabbitMQ connection and/or channel', e);
      throw e;
    }
  }

  private async reconnect() {
    const { retry = false, retryWait = 2000, timeoutMillis = undefined } =
      this.retryOptions || {};

    if (!this.connection) {
      const { user, password, host, port } = this.connectionDetails;
      const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
      this.logger.info(
        `Connecting to RabbitMQ @ amqp://${user}:***@${host}:${port}`,
      );
      const retryUntil = timeoutMillis ? new Date().getTime() : undefined;

      let connected = false;
      while (!connected) {
        try {
          this.connection = await amqp.connect(rabbitUrl);
          this.connection.on('close', this.handleConnectionClosed);
          // this.connection.on('error', () => console.error('CON ERROR'));
          connected = true;
        } catch (err) {
          this.logger.error(`Failed to connect to Rabbit`, err);
          if (retryUntil) {
            if (new Date().getTime() > retryUntil) {
              throw new Error('Timeout retrying to connect to Rabbit');
            }
          }
          this.logger.info(`Retrying connection after ${retryWait}ms`);
          await wait(retryWait);
        }
      }

      if(this.connection) {
        this.logger.info('Connection to RabbitMQ established successfully');
        this.channel = await this.connection.createConfirmChannel();
        this.logger.info('RabbitMQ channel opened');
  
        this.channel.on('close', this.handleChannelClosed);
      }
    } else {
      this.logger.warn(
        'Attempting to connect to RabbitMQ when already connected',
      );
    }

    this.handleConnected();
  }

  public getChannel(): ConfirmChannel {
    if (!this.channel || this.connectionState !== 'connected') {
      throw new Error('No connection');
    }
    return this.channel;
  }

  private handleConnected() {
    this.connectionState = 'connected';
    debugger;
    while (this.queuedListeners.length > 0) {
      const entry = this.queuedListeners.pop();
      entry?.();
    }
  }

  private handleConnectionClosed() {
    this.connection = undefined;
    this.channel = undefined;
    if (this.connectionState === 'disconnecting' || this.connectionState === 'disconnected') {
      this.connectionState = 'disconnected';
    } else {
      this.logger.warn('RabbitMQ connection closed unexpectedly, attempting to reconnect');
      this.connectionState = 'reconnecting';
      this.reconnect();
    }
  }

  private handleChannelClosed() {
    this.channel = undefined;
    if (this.connectionState === 'disconnecting') {
      this.connectionState = 'disconnected';
    } else {
      this.logger.warn('RabbitMQ channel closed unexpectedly, attempting to reconnect');
      this.connectionState = 'reconnecting';
      this.reconnect();
    }
  }

  // private handleConnectionError() {
  //   this.logger.info('Connection to rabbit channel unexpectedly lost');
  //   this.connectionState = 'reconnecting';
  //   this.channel = undefined;
  //   this.reconnect();
  // }

  public async waitUntilConnected(timeout?: number): Promise<void> {
    if (this.connectionState !== 'connected') {
      const promises = [];
      if (timeout) {
        promises.push(wait(timeout));
      }
      promises.push(
        new Promise<void>((res) => {
          this.logger.info('Operation queued until connection');
          this.queuedListeners.push(res);
        }),
      );
      return Promise.race(promises);
    }
    return Promise.resolve();
  }
}

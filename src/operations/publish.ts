import { ConfirmChannel } from 'amqplib';
import ILogger from '../logger';

export default async function publish<T>(
  channel: ConfirmChannel,
  exchange: string,
  routingKey: string = '',
  payload: T,
  logger: ILogger,
): Promise<boolean> {
  try {
    await channel.assertExchange(exchange, 'topic', {
      durable: false,
    });
    return new Promise(async (resolve) => {
      await channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        undefined,
        (err) => {
          if (err) {
            logger.error(err);
            resolve(false);
          } else {
            resolve(true);
          }
        },
      );
    });
  } catch (err) {
    return false;
  }
}

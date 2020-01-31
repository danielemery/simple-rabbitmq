import { flatMap } from 'rxjs/operators';
import { Rabbit } from '..';

export default function publishObservable<T>(
  rabbit: Rabbit<T>,
  exchange: string,
  routingKey: string = '',
) {
  return flatMap(async (toPublish: T) => {
    const result = await rabbit.publish(exchange, routingKey, toPublish);
    if (result) {
      return toPublish;
    } else {
      throw new Error(`Error publishing item to rabbit`);
    }
  });
}

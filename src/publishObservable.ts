import { flatMap } from 'rxjs/operators';
import Rabbit from './rabbit';

export default function publishObservable<T>(
  rabbit: Rabbit,
  exchange: string,
  routingKey: string = '',
) {
  return flatMap(async (toPublish: T) => {
    const result = await rabbit.publish<T>(exchange, routingKey, toPublish);
    if (result) {
      return toPublish;
    } else {
      throw new Error(`Error publishing item to rabbit`);
    }
  });
}

import { Observable, Subject } from 'rxjs';
import Rabbit from './rabbit';

export interface IRabbitObserver<T> {
  observable: Observable<T>;
  cancel: () => void;
}

export default async function<T>(
  rabbit: Rabbit,
  exchange: string,
  routingKey?: string,
): Promise<IRabbitObserver<T>> {
  const subject = new Subject<T>();

  const rabbitPromise = rabbit.listen<T>(
    exchange,
    routingKey,
    message => {
      subject.next(message);
    },
    () => {
      subject.complete();
    },
  );

  await rabbitPromise;

  return {
    observable: subject,
    cancel: async () => {
      const rabbitQueue = await rabbitPromise;
      rabbit.unlisten(rabbitQueue);
    },
  };
}

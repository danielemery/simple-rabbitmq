import { Observable, Subject } from 'rxjs';
import Rabbit from './rabbit';
import Envelope from './envelope';
import IListenOptions from './listen-options';

export interface IRabbitObserver<T> {
  observable: Observable<T>;
  cancel: () => void;
}

export default async function<T>(
  rabbit: Rabbit,
  exchange: string,
  options: IListenOptions,
): Promise<IRabbitObserver<Envelope<T>>> {
  const subject = new Subject<Envelope<T>>();

  const rabbitPromise = rabbit.listen<T>(
    exchange,
    options,
    envelope => {
      subject.next(envelope);
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

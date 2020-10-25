import { range } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  publishObservable,
  observeRabbit,
  acknowledgeEnvelopeObservable,
  Rabbit,
} from '../index';
import ITestMessage from './test-message';
import printObservable from './print-observable';

export default async function ackTest(rabbit: Rabbit) {
  await rabbit.connect();
  const { observable, cancel } = await observeRabbit<ITestMessage>(
    rabbit,
    'test_exchange',
    {
      queue: 'named-queue',
    },
  );
  console.log('Now Listening');

  observable
    .pipe(
      acknowledgeEnvelopeObservable(),
      printObservable<ITestMessage>('Recieved Message'),
    )
    .subscribe();

  await range(0, 10)
    .pipe(
      map((num) => ({
        text: `Test Message ${num}`,
      })),
      printObservable<ITestMessage>('Sent Message'),
      publishObservable<ITestMessage>(rabbit, 'test_exchange'),
    )
    .toPromise();

  await cancel();
  console.log('No Longer Listening');

  await range(0, 10)
    .pipe(
      map((num) => ({
        text: `Second Test Message ${num}`,
      })),
      printObservable<ITestMessage>('Sent Message'),
      publishObservable<ITestMessage>(rabbit, 'test_exchange'),
    )
    .toPromise();

  await rabbit.deleteQueue('named-queue');
  await rabbit.deleteExchange('test_exchange');
  await rabbit.disconnect();
}

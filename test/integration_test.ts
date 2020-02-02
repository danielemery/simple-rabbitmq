import { Rabbit, publishObservable } from '../index';
import { range } from 'rxjs';
import { map, flatMap } from 'rxjs/operators';
import observeRabbit from '../src/observe-rabbit';
import Envelope from '../src/envelope';

function printObservable<T>(message: string) {
  return map<T, T>(value => {
    console.log(`${message} ${JSON.stringify(value)}.`);
    return value;
  });
}

function acknowledgeObservable() {
  return flatMap(async (envelope: Envelope<any>) => {
    if(!envelope.acknowledge) {
      throw new Error('Cannot acknowledge');
    }
    await envelope.acknowledge();
    return envelope.message;
  });
}

interface ITestMessage {
  text: string;
}

async function runIntegrationTest() {
  const rabbit = new Rabbit({
    host: 'localhost',
    port: '5672',
    user: 'simple-rabbitmq',
    password: 'simple-rabbitmq',
  });
  await rabbit.connect();

  const { observable, cancel } = await observeRabbit<ITestMessage>(
    rabbit,
    'test_exchange',
    {},
  );
  console.log('Now Listening');

  observable
    .pipe(
      acknowledgeObservable(),
      printObservable<ITestMessage>('Recieved Message'),
    )
    .subscribe();

  await range(0, 10)
    .pipe(
      map(num => ({
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
      map(num => ({
        text: `Second Test Message ${num}`,
      })),
      printObservable<ITestMessage>('Sent Message'),
      publishObservable<ITestMessage>(rabbit, 'test_exchange'),
    )
    .toPromise();

  await rabbit.deleteExchange('test_exchange');
  await rabbit.disconnect();
  return;
}

console.log('Starting integration test');
runIntegrationTest()
  .then(() => console.log('Integration test completed successfully.'))
  .catch(err => {
    console.error(err);
  });

import { Rabbit } from '../index';
import ackTest from './ack-test';
import noAckTest from './no-ack-test';

async function runIntegrationTest() {
  const rabbit = new Rabbit({
    host: 'localhost',
    port: '5672',
    user: 'simple-rabbitmq',
    password: 'simple-rabbitmq',
  });

  console.log('Testing Acknowledge Case');
  await ackTest(rabbit);
  console.log('Testing No Acknowledge Case');
  await noAckTest(rabbit);

  return;
}

console.log('Starting integration test');
runIntegrationTest()
  .then(() => console.log('Integration test completed successfully.'))
  .catch(err => {
    console.error(err);
  });

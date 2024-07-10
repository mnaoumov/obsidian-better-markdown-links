const RETRY_DELAY_IN_MILLISECONDS = 100;
const TIMEOUT_IN_MILLISECONDS = 5000;

export async function retryWithTimeout(asyncFn: () => Promise<boolean>, options = {
  timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS,
  retryDelayInMilliseconds: RETRY_DELAY_IN_MILLISECONDS
}): Promise<void> {
  await runWithTimeout(options.timeoutInMilliseconds, async () => {
    while (true) {
      if (await asyncFn()) {
        console.debug("Retry completed successfully");
        return;
      }

      console.debug(`Retry completed unsuccessfully. Trying again in ${options.retryDelayInMilliseconds} milliseconds`);
      await delay(options.retryDelayInMilliseconds);
    }
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function runWithTimeout<R>(timeoutInMilliseconds: number, asyncFn: () => Promise<R>): Promise<R> {
  return await Promise.race([asyncFn(), timeout()]);

  async function timeout(): Promise<never> {
    await delay(timeoutInMilliseconds);
    throw new Error(`Timed out in ${timeoutInMilliseconds} milliseconds`);
  }
}

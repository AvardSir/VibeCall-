import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;

// Adapts an async (req, res) handler to Express, forwarding rejections to the error middleware
// so routes avoid repeating the `void handler(req, res).catch(next)` boilerplate.
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void handler(req, res).catch(next);
  };
}

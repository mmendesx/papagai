import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildMockHost(requestUrl: string, requestMethod: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const mockResponse = { status };
  const mockRequest = { url: requestUrl, method: requestMethod };

  const mockHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  };

  return { mockHost, mockResponse, mockRequest, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  describe('Scenario 28: HttpException returns structured error response', () => {
    it('sets the HTTP status code on the response to match the exception status', () => {
      const { mockHost, status, json } = buildMockHost('/api/test', 'GET');
      const exception = new HttpException(
        'Bad Request',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost as any);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(json).toHaveBeenCalled();
    });

    it('returns a body containing statusCode, timestamp, path, message, and error fields', () => {
      const { mockHost, json } = buildMockHost('/api/users', 'POST');
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('error');
    });

    it('sets statusCode in the body to the exception HTTP status', () => {
      const { mockHost, json } = buildMockHost('/api/items', 'GET');
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    });

    it('sets path in the body to the request URL', () => {
      const requestUrl = '/api/orders/42';
      const { mockHost, json } = buildMockHost(requestUrl, 'GET');
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.path).toBe(requestUrl);
    });

    it('sets timestamp to a valid ISO date string', () => {
      const { mockHost, json } = buildMockHost('/api/test', 'GET');
      const exception = new HttpException(
        'Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      const before = Date.now();
      filter.catch(exception, mockHost as any);
      const after = Date.now();

      const body = json.mock.calls[0][0];
      const parsed = Date.parse(body.timestamp);

      expect(isNaN(parsed)).toBe(false);
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(after);
    });
  });

  describe('message extraction', () => {
    it('extracts message from a string exception response', () => {
      const { mockHost, json } = buildMockHost('/api/test', 'DELETE');
      const exception = new HttpException(
        'Unauthorized access',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      // When getResponse() is a string, the filter falls back to exception.message
      expect(body.message).toBe('Unauthorized access');
    });

    it('extracts message from an object exception response with a message field', () => {
      const { mockHost, json } = buildMockHost('/api/test', 'POST');
      const exception = new HttpException(
        { message: 'Validation failed', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.message).toBe('Validation failed');
    });

    it('extracts error from an object exception response with an error field', () => {
      const { mockHost, json } = buildMockHost('/api/test', 'POST');
      const exception = new HttpException(
        { message: 'email must be an email', error: 'Unprocessable Entity' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.error).toBe('Unprocessable Entity');
    });

    it('falls back to exception.name as error when the response has no error field', () => {
      const { mockHost, json } = buildMockHost('/api/test', 'GET');
      const exception = new HttpException(
        'Simple string response',
        HttpStatus.BAD_GATEWAY,
      );

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.error).toBe(exception.name);
    });
  });

  describe('Scenario 27: ValidationPipe-level 400 passes through with correct shape', () => {
    it('handles a 400 with an array of validation messages in the message field', () => {
      const { mockHost, status, json } = buildMockHost('/api/messages', 'POST');
      const exception = new HttpException(
        {
          message: ['name should not be empty', 'phone must be a phone number'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost as any);

      expect(status).toHaveBeenCalledWith(400);
      const body = json.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.message).toEqual([
        'name should not be empty',
        'phone must be a phone number',
      ]);
      expect(body.error).toBe('Bad Request');
      expect(body.path).toBe('/api/messages');
    });
  });

  describe('custom code field', () => {
    it('includes string code from exception response body when present', () => {
      const { mockHost, json } = buildMockHost('/api/auth/register', 'POST');
      const exception = new HttpException(
        {
          message: 'Invalid application key',
          error: 'Forbidden',
          code: 'INVALID_APP_KEY',
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, mockHost as any);

      const body = json.mock.calls[0][0];
      expect(body.code).toBe('INVALID_APP_KEY');
    });
  });
});

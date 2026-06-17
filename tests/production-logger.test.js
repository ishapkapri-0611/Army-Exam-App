const ProductionLogger = require('../shared-lib/utils/production-logger');

describe('ProductionLogger', () => {
    let logger;
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should set logLevel to debug in development', () => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
            expect(logger.logLevel).toBe('debug');
        });

        it('should set logLevel to info in production', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            expect(logger.logLevel).toBe('info');
        });

        it('should set logLevel to info by default', () => {
            delete process.env.NODE_ENV;
            logger = new ProductionLogger();
            expect(logger.logLevel).toBe('info');
        });
    });

    describe('shouldLog', () => {
        it('should allow error messages at info level', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            expect(logger.shouldLog('error')).toBe(true);
        });

        it('should allow warn messages at info level', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            expect(logger.shouldLog('warn')).toBe(true);
        });

        it('should allow info messages at info level', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            expect(logger.shouldLog('info')).toBe(true);
        });

        it('should block debug messages at info level', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            expect(logger.shouldLog('debug')).toBe(false);
        });

        it('should allow all messages at debug level', () => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
            expect(logger.shouldLog('error')).toBe(true);
            expect(logger.shouldLog('warn')).toBe(true);
            expect(logger.shouldLog('info')).toBe(true);
            expect(logger.shouldLog('debug')).toBe(true);
        });
    });

    describe('log', () => {
        it('should output when level is allowed', () => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
            logger.log('info', 'Test message');
            expect(console.log).toHaveBeenCalled();
        });

        it('should not output when level is blocked', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();
            logger.log('debug', 'Test debug message');
            expect(console.log).not.toHaveBeenCalled();
        });

        it('should include timestamp and level in output', () => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
            logger.log('info', 'Hello world');

            const call = console.log.mock.calls[0][0];
            expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
            expect(call).toMatch(/INFO/);
            expect(call).toContain('Hello world');
        });

        it('should include data when provided', () => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
            const data = { key: 'value' };
            logger.log('info', 'Test', data);

            expect(console.log).toHaveBeenCalledWith(
                expect.any(String),
                data
            );
        });
    });

    describe('convenience methods', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
            logger = new ProductionLogger();
        });

        it('info should log at info level', () => {
            logger.info('Info message');
            const call = console.log.mock.calls[0][0];
            expect(call).toContain('INFO');
        });

        it('warn should log at warn level', () => {
            logger.warn('Warning message');
            const call = console.log.mock.calls[0][0];
            expect(call).toContain('WARN');
        });

        it('error should log at error level', () => {
            logger.error('Error message');
            const call = console.log.mock.calls[0][0];
            expect(call).toContain('ERROR');
        });

        it('debug should log at debug level', () => {
            logger.debug('Debug message');
            const call = console.log.mock.calls[0][0];
            expect(call).toContain('DEBUG');
        });

        it('should pass data through convenience methods', () => {
            const data = { error: 'something failed' };
            logger.error('Failed', data);
            expect(console.log).toHaveBeenCalledWith(expect.any(String), data);
        });
    });

    describe('writeToFile', () => {
        it('should write log entry to file in production', () => {
            process.env.NODE_ENV = 'production';
            logger = new ProductionLogger();

            const fs = require('fs');
            const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
            const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            logger.log('error', 'Critical error');

            expect(mkdirSpy).toHaveBeenCalled();
            expect(appendSpy).toHaveBeenCalled();

            mkdirSpy.mockRestore();
            appendSpy.mockRestore();
        });
    });
});

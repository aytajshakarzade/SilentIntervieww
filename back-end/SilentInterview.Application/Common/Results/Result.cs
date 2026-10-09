namespace SilentInterview.Application.Common.Results;

public class Result
{
    public bool IsSuccess { get; }

    public string Message { get; }

    protected Result(bool isSuccess, string message)
    {
        IsSuccess = isSuccess;
        Message = message;
    }

    public static Result Success(string message = "")
        => new(true, message);

    public static Result Failure(string message)
        => new(false, message);
}

public class Result<T> : Result
{
    public T? Value { get; }

    private Result(
        bool success,
        T? value,
        string message)
        : base(success, message)
    {
        Value = value;
    }

    public static Result<T> Success(
        T value,
        string message = "")
        => new(true, value, message);

    public static new Result<T> Failure(
        string message)
        => new(false, default, message);
}
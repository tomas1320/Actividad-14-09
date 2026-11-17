Feature: Register a user
  As a visitor
  I want to create an account
  So that I can book rooms

  Scenario: Register with valid details
    Given no account exists with email "ana@example.com"
    When I register "Ana" with email "ana@example.com" and password "secret123"
    Then the response status should be 201
    And the response should not expose a password or password hash
    And the stored password for "ana@example.com" should be hashed

  Scenario: Reject a duplicate email
    Given an account exists with email "ana@example.com"
    When I register "Ana Two" with email "ana@example.com" and password "secret456"
    Then the response status should be 409

Feature: Create a room booking
  As a registered user
  I want to book an available room
  So that I can secure a workspace

  Scenario: Book an available room
    Given user "ana@example.com" exists
    And the coworking rooms are available
    When that user books "Sala A" on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 201
    And the booking status should be "CONFIRMED"

  Scenario: Reject a booking without authentication
    Given the coworking rooms are available
    When I attempt to book "Sala A" without authentication on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 401

  Scenario: Reject an invalid booking interval
    Given user "ana@example.com" exists
    When that user books "Sala A" on "2026-10-15" from "11:00" to "10:00"
    Then the response status should be 400
